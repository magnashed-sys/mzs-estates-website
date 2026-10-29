-- Staging candidate: purchase supplier payment registration, not bank synchronization.
-- No seed data. No automatic payments, invoice approvals, VAT deductions or general ledger.
begin;
set local lock_timeout='2s';

create table public.mzs_accountancy_supplier_payments (
 id uuid primary key,
 draft_id uuid not null references public.mzs_ops_expense_drafts(id) on delete restrict,
 issuer_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 paid_on date not null check(paid_on>=date '2000-01-01'),
 reference text not null check(length(btrim(reference)) between 3 and 200 and reference !~ '[[:cntrl:]]'),
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index mzs_supplier_payments_draft_date on public.mzs_accountancy_supplier_payments(draft_id,paid_on,id);
create index mzs_supplier_payments_issuer on public.mzs_accountancy_supplier_payments(issuer_id,paid_on);
create index mzs_supplier_payments_actor on public.mzs_accountancy_supplier_payments(recorded_by);

create table public.mzs_accountancy_supplier_payment_reversals (
 payment_id uuid primary key references public.mzs_accountancy_supplier_payments(id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 8 and 500 and reason !~ '[[:cntrl:]]'),
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index mzs_supplier_payment_reversals_actor on public.mzs_accountancy_supplier_payment_reversals(recorded_by);

create function mzs_private.supplier_payment_immutable() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Supplier payment evidence is immutable; add a reversal' using errcode='42501';
end $$;
create trigger supplier_payment_no_mutation before update or delete on public.mzs_accountancy_supplier_payments
 for each row execute function mzs_private.supplier_payment_immutable();
create trigger supplier_payment_reversal_no_mutation before update or delete on public.mzs_accountancy_supplier_payment_reversals
 for each row execute function mzs_private.supplier_payment_immutable();
revoke all on function mzs_private.supplier_payment_immutable() from public,anon,authenticated,service_role;
alter table public.mzs_accountancy_supplier_payments enable row level security;
alter table public.mzs_accountancy_supplier_payment_reversals enable row level security;
revoke all on public.mzs_accountancy_supplier_payments,public.mzs_accountancy_supplier_payment_reversals from public,anon,authenticated,service_role;
grant select on public.mzs_accountancy_supplier_payments,public.mzs_accountancy_supplier_payment_reversals to authenticated;
create policy supplier_payment_admin_read on public.mzs_accountancy_supplier_payments
 for select to authenticated using((select public.is_admin()));
create policy supplier_payment_reversal_admin_read on public.mzs_accountancy_supplier_payment_reversals
 for select to authenticated using((select public.is_admin()));
-- No direct INSERT, UPDATE, DELETE to browser users. Only vetted RPC writes.

create function mzs_private.record_supplier_payment(
 p_id uuid,p_draft uuid,p_amount_cents bigint,p_paid_on date,p_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.mzs_ops_expense_drafts;
 prior public.mzs_accountancy_supplier_payments;
 paid bigint;ref text:=btrim(p_reference);
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Active administrator required' using errcode='42501';
 end if;
 if p_id is null or p_draft is null or p_amount_cents is null or
    p_amount_cents not between 1 and 100000000000 or p_paid_on is null or
    p_paid_on<date '2000-01-01' or p_paid_on>(now() at time zone 'Europe/Madrid')::date or
    ref is null or length(ref) not between 3 and 200 or ref ~ '[[:cntrl:]]' then
  raise exception 'Check supplier payment date, amount and reference' using errcode='22023';
 end if;
 select * into inv from public.mzs_ops_expense_drafts where id=p_draft for update;
 if not found or inv.status<>'draft' or inv.currency<>'EUR' or inv.gross_cents<=0 then
  raise exception 'Supplier concept unavailable' using errcode='22023';
 end if;
 -- This is a payment record only after the source cost was explicitly reviewed.
 if not exists(
   select 1 from public.mzs_accountancy_cost_reviews v
   join public.mzs_accountancy_years y on y.id=v.year_id
   where v.draft_id=p_draft and v.review_status='reviewed'
    and y.issuer_id=inv.legal_entity_id
    and y.fiscal_year=extract(year from inv.invoice_date)::integer
 ) then raise exception 'Supplier cost must be reviewed first' using errcode='22023';end if;
 select * into prior from public.mzs_accountancy_supplier_payments where id=p_id;
 if found then
   if prior.draft_id<>p_draft or prior.issuer_id<>inv.legal_entity_id or
      prior.amount_cents<>p_amount_cents or prior.paid_on<>p_paid_on or prior.reference<>ref then
     raise exception 'Request ID already used for different payment details' using errcode='22023';
   end if;
   if exists(select 1 from public.mzs_accountancy_supplier_payment_reversals v where v.payment_id=p_id) then
     raise exception 'This payment was reversed; use a new request ID' using errcode='22023';
   end if;
   return p_id;
 end if;
 if exists(
  select 1 from public.mzs_accountancy_supplier_payments r
  where r.draft_id=p_draft and lower(r.reference)=lower(ref)
   and not exists(select 1 from public.mzs_accountancy_supplier_payment_reversals v where v.payment_id=r.id)
 ) then raise exception 'An active payment with this reference exists for this invoice' using errcode='22023';end if;
 select coalesce(sum(r.amount_cents),0) into paid
 from public.mzs_accountancy_supplier_payments r
 where r.draft_id=p_draft
  and not exists(select 1 from public.mzs_accountancy_supplier_payment_reversals v where v.payment_id=r.id);
 if paid+p_amount_cents>inv.gross_cents then
  raise exception 'Payment exceeds remaining invoice amount; record overpayments as separately reviewed credit evidence' using errcode='22023';
 end if;
 insert into public.mzs_accountancy_supplier_payments
  (id,draft_id,issuer_id,amount_cents,paid_on,reference,recorded_by)
 values(p_id,p_draft,inv.legal_entity_id,p_amount_cents,p_paid_on,ref,auth.uid());
 return p_id;
end $$;
create function mzs_private.reverse_supplier_payment(
 p_id uuid,p_draft uuid,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.mzs_ops_expense_drafts;
 prior public.mzs_accountancy_supplier_payments;
 old_reason text;reason text:=btrim(p_reason);
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Active administrator required' using errcode='42501';
 end if;
 if p_id is null or p_draft is null or reason is null or
    length(reason) not between 8 and 500 or reason ~ '[[:cntrl:]]' then
  raise exception 'Provide a reversal reason of 8 to 500 characters' using errcode='22023';
 end if;
 select * into inv from public.mzs_ops_expense_drafts where id=p_draft for update;
 if not found then raise exception 'Supplier invoice not found' using errcode='22023';end if;
 select * into prior from public.mzs_accountancy_supplier_payments where id=p_id and draft_id=p_draft;
 if not found then raise exception 'Payment does not belong to this invoice' using errcode='22023';end if;
 select v.reason into old_reason from public.mzs_accountancy_supplier_payment_reversals v where v.payment_id=p_id;
 if found then
  if old_reason<>reason then raise exception 'Already reversed with a different reason' using errcode='22023';end if;
  return p_id;
 end if;
 insert into public.mzs_accountancy_supplier_payment_reversals(payment_id,reason,recorded_by)
 values(p_id,reason,auth.uid());
 return p_id;
end $$;
revoke all on function mzs_private.record_supplier_payment(uuid,uuid,bigint,date,text),
 mzs_private.reverse_supplier_payment(uuid,uuid,text) from public,anon,authenticated,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.record_supplier_payment(uuid,uuid,bigint,date,text),
 mzs_private.reverse_supplier_payment(uuid,uuid,text) to authenticated;
create function public.mzs_record_supplier_payment(
 p_id uuid,p_draft uuid,p_amount_cents bigint,p_paid_on date,p_reference text
) returns uuid language sql security invoker set search_path='' as $$
 select mzs_private.record_supplier_payment(p_id,p_draft,p_amount_cents,p_paid_on,p_reference) $$;
create function public.mzs_reverse_supplier_payment(
 p_id uuid,p_draft uuid,p_reason text
) returns uuid language sql security invoker set search_path='' as $$
 select mzs_private.reverse_supplier_payment(p_id,p_draft,p_reason) $$;
revoke all on function public.mzs_record_supplier_payment(uuid,uuid,bigint,date,text),
 public.mzs_reverse_supplier_payment(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_record_supplier_payment(uuid,uuid,bigint,date,text),
 public.mzs_reverse_supplier_payment(uuid,uuid,text) to authenticated;

create function public.mzs_supplier_payment_source(p_draft_ids uuid[])
 returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows jsonb;total bigint;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Active administrator required' using errcode='42501';
 end if;
 if p_draft_ids is null or cardinality(p_draft_ids) not between 1 and 100 or
    (select count(distinct id) from public.mzs_ops_expense_drafts where id=any(p_draft_ids))<>cardinality(p_draft_ids)
 then raise exception 'Invalid supplier payment selection' using errcode='22023';end if;
 select count(*) into total from public.mzs_accountancy_supplier_payments where draft_id=any(p_draft_ids);
 if total>10000 then raise exception 'Payment register too large' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.paid_on,x.id),'[]'::jsonb) into rows from (
  select r.*,v.created_at reversed_at,v.recorded_by reversed_by,v.reason reversal_reason
  from public.mzs_accountancy_supplier_payments r
  left join public.mzs_accountancy_supplier_payment_reversals v on v.payment_id=r.id
  where r.draft_id=any(p_draft_ids)
 ) x;
 return jsonb_build_object('rows',rows,'count',total,'snapshot_at',statement_timestamp());
end $$;
revoke all on function public.mzs_supplier_payment_source(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.mzs_supplier_payment_source(uuid[]) to authenticated;
comment on table public.mzs_accountancy_supplier_payments is
'Administrator-recorded supplier payment evidence, with no automatic bank matching or external bank transfer. All amounts are EUR cents. Reversals are append-only.';
comment on table public.mzs_accountancy_supplier_payment_reversals is
'Immutable administrative payment corrections. A reversal does not itself prove a bank refund.';
commit;
