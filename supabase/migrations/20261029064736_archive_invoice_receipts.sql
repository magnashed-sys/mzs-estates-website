-- Additive, empty receipt ledger. Original imported invoices remain immutable.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
create table public.mzs_archive_invoice_receipts(
 id uuid primary key,
 invoice_id uuid not null references public.mzs_invoice_archive(id),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 received_on date not null check(received_on>=date '2000-01-01'),
 reference text not null check(length(btrim(reference)) between 3 and 200 and reference=btrim(reference) and reference !~ '[[:cntrl:]]'),
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index archive_receipts_invoice_idx on public.mzs_archive_invoice_receipts(invoice_id);
create index archive_receipts_actor_idx on public.mzs_archive_invoice_receipts(recorded_by);
create table public.mzs_archive_invoice_receipt_reversals(
 receipt_id uuid primary key references public.mzs_archive_invoice_receipts(id),
 reason text not null check(length(btrim(reason)) between 8 and 500 and reason=btrim(reason) and reason !~ '[[:cntrl:]]'),
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index archive_receipt_reversals_actor_idx on public.mzs_archive_invoice_receipt_reversals(recorded_by);
alter table public.mzs_archive_invoice_receipts enable row level security;
alter table public.mzs_archive_invoice_receipt_reversals enable row level security;
revoke all on public.mzs_archive_invoice_receipts,public.mzs_archive_invoice_receipt_reversals from public,anon,authenticated,service_role;
grant select on public.mzs_archive_invoice_receipts,public.mzs_archive_invoice_receipt_reversals to authenticated;
create policy archive_receipts_admin_read on public.mzs_archive_invoice_receipts for select to authenticated using((select public.is_admin()));
create policy archive_receipt_reversals_admin_read on public.mzs_archive_invoice_receipt_reversals for select to authenticated using((select public.is_admin()));
create function mzs_private.archive_receipt_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Payment history is immutable; record a reversal instead' using errcode='42501';end $$;
revoke all on function mzs_private.archive_receipt_immutable() from public,anon,authenticated,service_role;
create trigger archive_receipts_immutable before update or delete on public.mzs_archive_invoice_receipts for each row execute function mzs_private.archive_receipt_immutable();
create trigger archive_receipt_reversals_immutable before update or delete on public.mzs_archive_invoice_receipt_reversals for each row execute function mzs_private.archive_receipt_immutable();

-- These two private functions are the only write path. Invoice row locks serialize
-- concurrent receipts and reversals, including repeated requests from two tabs.
create function mzs_private.record_archive_invoice_receipt(p_id uuid,p_invoice uuid,p_amount_cents bigint,p_received_on date,p_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.mzs_invoice_archive;prior public.mzs_archive_invoice_receipts;paid bigint;ref text:=btrim(p_reference);
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_invoice is null or p_amount_cents is null or p_amount_cents not between 1 and 100000000000 or p_received_on is null or p_received_on<date '2000-01-01' or p_received_on>(now() at time zone 'Europe/Madrid')::date or ref is null or length(ref) not between 3 and 200 or ref ~ '[[:cntrl:]]' then raise exception 'Check amount, payment date and reference' using errcode='22023';end if;
 select * into inv from public.mzs_invoice_archive where id=p_invoice for update;
 if not found or inv.gross_cents<=0 or inv.source_open_cents<=0 or inv.source_paid_cents<0 then raise exception 'Imported invoice not found' using errcode='22023';end if;
 if exists(select 1 from public.mzs_invoice_archive_exclusions where invoice_id=p_invoice) then raise exception 'Excluded invoices cannot receive payments' using errcode='22023';end if;
 if exists(select 1 from public.mzs_lease_invoices where issuer_id=inv.issuer_id and upper(btrim(number))=upper(btrim(inv.number))) or exists(select 1 from public.mzs_booking_invoices where issuer_id=inv.issuer_id and upper(btrim(number))=upper(btrim(inv.number))) or exists(select 1 from public.mzs_ops_external_sales_invoices where issuer_id=inv.issuer_id and upper(btrim(number))=upper(btrim(inv.number))) then raise exception 'Use the matching live invoice to record this payment' using errcode='22023';end if;
 select * into prior from public.mzs_archive_invoice_receipts where id=p_id;
 if found then
  if prior.invoice_id<>p_invoice or prior.amount_cents<>p_amount_cents or prior.received_on<>p_received_on or prior.reference<>ref then raise exception 'Request identifier already used for different payment details' using errcode='22023';end if;
  if exists(select 1 from public.mzs_archive_invoice_receipt_reversals where receipt_id=p_id) then raise exception 'This payment was reversed; refresh before recording a replacement' using errcode='22023';end if;
  return p_id;
 end if;
 if exists(select 1 from public.mzs_archive_invoice_receipts r where r.invoice_id=p_invoice and lower(r.reference)=lower(ref) and not exists(select 1 from public.mzs_archive_invoice_receipt_reversals v where v.receipt_id=r.id)) then raise exception 'An active payment with this reference already exists' using errcode='22023';end if;
 select coalesce(sum(r.amount_cents),0) into paid from public.mzs_archive_invoice_receipts r where r.invoice_id=p_invoice and not exists(select 1 from public.mzs_archive_invoice_receipt_reversals v where v.receipt_id=r.id);
 if paid+p_amount_cents>inv.source_open_cents then raise exception 'Payment exceeds the remaining invoice balance; refresh the invoice' using errcode='22023';end if;
 insert into public.mzs_archive_invoice_receipts(id,invoice_id,amount_cents,received_on,reference,recorded_by) values(p_id,p_invoice,p_amount_cents,p_received_on,ref,auth.uid());
 return p_id;
end $$;
create function mzs_private.reverse_archive_invoice_receipt(p_id uuid,p_invoice uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare prior_reason text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_invoice is null or p_reason is null or length(btrim(p_reason)) not between 8 and 500 or p_reason ~ '[[:cntrl:]]' then raise exception 'Enter a reversal reason of 8 to 500 characters' using errcode='22023';end if;
 perform 1 from public.mzs_invoice_archive where id=p_invoice for update;
 if not found or not exists(select 1 from public.mzs_archive_invoice_receipts where id=p_id and invoice_id=p_invoice) then raise exception 'Payment does not belong to this invoice' using errcode='22023';end if;
 select reason into prior_reason from public.mzs_archive_invoice_receipt_reversals where receipt_id=p_id;
 if found then
  if prior_reason<>btrim(p_reason) then raise exception 'This payment was already reversed; refresh its history' using errcode='22023';end if;
  return p_id;
 end if;
 insert into public.mzs_archive_invoice_receipt_reversals(receipt_id,reason,recorded_by) values(p_id,btrim(p_reason),auth.uid());
 return p_id;
end $$;
revoke all on function mzs_private.record_archive_invoice_receipt(uuid,uuid,bigint,date,text),mzs_private.reverse_archive_invoice_receipt(uuid,uuid,text) from public,anon,authenticated,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.record_archive_invoice_receipt(uuid,uuid,bigint,date,text),mzs_private.reverse_archive_invoice_receipt(uuid,uuid,text) to authenticated;
create function public.mzs_record_archive_invoice_receipt(p_id uuid,p_invoice uuid,p_amount_cents bigint,p_received_on date,p_reference text)
returns uuid language sql security invoker set search_path='' as $$select mzs_private.record_archive_invoice_receipt(p_id,p_invoice,p_amount_cents,p_received_on,p_reference)$$;
create function public.mzs_reverse_archive_invoice_receipt(p_id uuid,p_invoice uuid,p_reason text)
returns uuid language sql security invoker set search_path='' as $$select mzs_private.reverse_archive_invoice_receipt(p_id,p_invoice,p_reason)$$;
revoke all on function public.mzs_record_archive_invoice_receipt(uuid,uuid,bigint,date,text),public.mzs_reverse_archive_invoice_receipt(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_record_archive_invoice_receipt(uuid,uuid,bigint,date,text),public.mzs_reverse_archive_invoice_receipt(uuid,uuid,text) to authenticated;

create function public.mzs_archive_invoice_receipt_source(p_invoice_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows jsonb;total bigint;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_invoice_ids is null or cardinality(p_invoice_ids) not between 1 and 100 or (select count(*) from public.mzs_invoice_archive where id=any(p_invoice_ids))<>cardinality(p_invoice_ids) then raise exception 'Invalid standalone invoice selection';end if;
 select count(*) into total from public.mzs_archive_invoice_receipts where invoice_id=any(p_invoice_ids);
 if total>10000 then raise exception 'Payment register too large for one selection';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.received_on,x.id),'[]'::jsonb) into rows from (
  select r.*,v.created_at reversed_at,v.recorded_by reversed_by,v.reason reversal_reason
  from public.mzs_archive_invoice_receipts r left join public.mzs_archive_invoice_receipt_reversals v on v.receipt_id=r.id where r.invoice_id=any(p_invoice_ids)
 ) x;
 return jsonb_build_object('invoice_ids',p_invoice_ids,'count',total,'rows',rows,'snapshot_at',statement_timestamp());
end $$;
revoke all on function public.mzs_archive_invoice_receipt_source(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.mzs_archive_invoice_receipt_source(uuid[]) to authenticated;
comment on table public.mzs_archive_invoice_receipts is 'Administrator-recorded EUR receipts for imported invoices, in addition to the immutable imported paid balance. Not bank synchronization. Original source status is unchanged.';
comment on table public.mzs_archive_invoice_receipt_reversals is 'Permanent administrative reversals; not bank refunds. Original receipt and actor are retained.';

commit;
