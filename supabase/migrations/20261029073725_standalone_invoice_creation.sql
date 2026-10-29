begin;
set local lock_timeout='2s';
create table public.mzs_service_invoice_drafts(id uuid primary key,issuer_id uuid not null references public.mzs_lease_issuers(id),customer_id uuid not null references public.mzs_lease_relationships(id),spec jsonb not null,payload jsonb not null,net_cents bigint not null,vat_cents bigint not null,gross_cents bigint not null check(gross_cents>0 and gross_cents=net_cents+vat_cents),due_on date not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table public.mzs_service_invoices(id uuid primary key default gen_random_uuid(),draft_id uuid unique not null references public.mzs_service_invoice_drafts(id),issuer_id uuid not null references public.mzs_lease_issuers(id),customer_id uuid not null references public.mzs_lease_relationships(id),number text not null,issued_on date not null,due_on date not null,net_cents bigint not null,vat_cents bigint not null,gross_cents bigint not null check(gross_cents>0 and gross_cents=net_cents+vat_cents),currency text not null default 'EUR' check(currency='EUR'),status text not null default 'issued' check(status='issued'),payload jsonb not null,issued_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(issuer_id,number));
create table public.mzs_service_draft_cancellations(draft_id uuid primary key references public.mzs_service_invoice_drafts(id),reason text not null check(length(btrim(reason)) between 8 and 500),actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index service_draft_issuer on public.mzs_service_invoice_drafts(issuer_id);
create index service_draft_customer on public.mzs_service_invoice_drafts(customer_id);
create index service_draft_actor on public.mzs_service_invoice_drafts(created_by);
create index service_invoice_customer on public.mzs_service_invoices(customer_id);
create index service_invoice_actor on public.mzs_service_invoices(issued_by);
create index service_cancel_actor on public.mzs_service_draft_cancellations(actor_id);
do $$declare t text;begin foreach t in array array['mzs_service_invoice_drafts','mzs_service_invoices','mzs_service_draft_cancellations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using((select public.is_admin()))',t);
 execute format('create trigger immutable before update or delete on public.%I for each row execute function mzs_private.external_receipt_immutable()',t);
end loop;end $$;
create function mzs_private.create_service_draft(p_id uuid,p_issuer uuid,p_customer uuid,p_spec jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.mzs_lease_issuers;c public.mzs_lease_relationships;d public.mzs_service_invoice_drafts;l jsonb;lines jsonb:='[]';qty numeric;unit bigint;rate numeric;net bigint;tax bigint;n bigint:=0;v bigint:=0;due date;payload jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_spec is null or jsonb_typeof(p_spec)<>'object' or pg_column_size(p_spec)>50000 then raise exception 'Invalid draft' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into d from public.mzs_service_invoice_drafts where id=p_id;
 if found then if d.issuer_id=p_issuer and d.customer_id=p_customer and d.spec=p_spec then return p_id;else raise exception 'Request identifier already used' using errcode='22023';end if;end if;
 select * into e from public.mzs_lease_issuers where id=p_issuer;if not found then raise exception 'Select an issuing entity' using errcode='22023';end if;
 select * into c from public.mzs_lease_relationships where id=p_customer;if not found then raise exception 'Select a customer' using errcode='22023';end if;
 if coalesce(length(btrim(p_spec->>'subject')),0) not between 2 and 300 or coalesce(length(btrim(p_spec->>'address')),0) not between 2 and 1000 or coalesce(length(btrim(e.address)),0)<2 or coalesce(length(btrim(e.iban)),0)<5 or coalesce(length(p_spec->>'reference'),0)>200 or coalesce(length(p_spec->>'attention'),0)>200 or coalesce(length(p_spec->>'tax_id'),0)>100 or coalesce(length(p_spec->>'terms'),0)>1000 then raise exception 'Complete billing details and bank account before saving' using errcode='22023';end if;
 if coalesce(p_spec->>'due_on','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid due date' using errcode='22023';end if;due:=(p_spec->>'due_on')::date;
 if due<(now() at time zone 'Europe/Madrid')::date then raise exception 'Due date cannot be in the past' using errcode='22023';end if;
 if jsonb_typeof(p_spec->'lines') is distinct from 'array' then raise exception 'Invoice lines required' using errcode='22023';end if;
 if jsonb_array_length(p_spec->'lines') not between 1 and 30 then raise exception 'Use 1 to 30 invoice lines' using errcode='22023';end if;
 for l in select value from jsonb_array_elements(p_spec->'lines') loop
 if coalesce(length(btrim(l->>'description')),0) not between 2 and 1000 or coalesce(l->>'quantity','') !~ '^[0-9]{1,6}(\.[0-9]{1,3})?$' or coalesce(l->>'unit_cents','') !~ '^[0-9]{1,10}$' or (l->>'vat' is distinct from 'exempt' and coalesce(l->>'vat','') !~ '^[0-9]{1,2}(\.[0-9]{1,2})?$') then raise exception 'Invalid invoice line' using errcode='22023';end if;
 qty:=(l->>'quantity')::numeric;unit:=(l->>'unit_cents')::bigint;rate:=case when l->>'vat'='exempt' then 0 else (l->>'vat')::numeric end;
 if qty<=0 or unit<=0 then raise exception 'Quantity and price must be positive' using errcode='22023';end if;
 net:=round(qty*unit);tax:=round(net*rate/100);if net<=0 then raise exception 'Line amount too small' using errcode='22023';end if;n:=n+net;v:=v+tax;
 lines:=lines||jsonb_build_array(jsonb_build_object('description',(l->>'description')||' ('||qty||' x EUR '||(unit::numeric/100)||')','net',net::numeric/100,'tax',tax::numeric/100,'total',(net+tax)::numeric/100,'vat',l->>'vat'));
 end loop;
 if n+v>100000000000 then raise exception 'Invoice exceeds amount limit' using errcode='22023';end if;
 payload:=jsonb_build_object('subject',btrim(p_spec->>'subject'),'period_start','','period_end','','subtotal',n::numeric/100,'tax_total',v::numeric/100,'lines',lines,'issuer_registration',e.registration_number,'snapshot',jsonb_build_object('issuer_name',e.name,'issuer_address',e.address,'issuer_iban',e.iban,'issuer_tax_id',e.tax_id,'issuer_details',case when e.kind='person' then e.details-'logo' else e.details end,'tenant_name',c.name,'tenant_address',btrim(p_spec->>'address'),'tenant_email',c.email,'tenant_attention',coalesce(p_spec->>'attention',''),'tenant_tax_id',coalesce(p_spec->>'tax_id',''),'customer_reference',coalesce(p_spec->>'reference',''),'payment_conditions',coalesce(p_spec->>'terms','')));
 insert into public.mzs_service_invoice_drafts values(p_id,p_issuer,p_customer,p_spec,payload,n,v,n+v,due,auth.uid(),now());return p_id;
end $$;
create function mzs_private.issue_service_invoice(p_draft uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.mzs_service_invoice_drafts;e public.mzs_lease_issuers;existing uuid;result uuid;num text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into d from public.mzs_service_invoice_drafts where id=p_draft for update;if not found then raise exception 'Draft not found' using errcode='22023';end if;
 select id into existing from public.mzs_service_invoices where draft_id=p_draft;if found then return existing;end if;
 if exists(select 1 from public.mzs_service_draft_cancellations where draft_id=p_draft) then raise exception 'Draft cancelled' using errcode='22023';end if;
 if d.due_on<(now() at time zone 'Europe/Madrid')::date then raise exception 'Create a revised draft with a current due date' using errcode='22023';end if;
 select * into strict e from public.mzs_lease_issuers where id=d.issuer_id for update;
 num:=e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)),'0');
 insert into public.mzs_service_invoices(draft_id,issuer_id,customer_id,number,issued_on,due_on,net_cents,vat_cents,gross_cents,payload,issued_by) values(d.id,d.issuer_id,d.customer_id,num,(now() at time zone 'Europe/Madrid')::date,d.due_on,d.net_cents,d.vat_cents,d.gross_cents,d.payload,auth.uid()) returning id into result;
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;return result;
end $$;
create function mzs_private.cancel_service_draft(p_draft uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 perform 1 from public.mzs_service_invoice_drafts where id=p_draft for update;if not found or exists(select 1 from public.mzs_service_invoices where draft_id=p_draft) then raise exception 'Only unissued drafts can be cancelled' using errcode='22023';end if;
 if p_reason is null or length(btrim(p_reason)) not between 8 and 500 then raise exception 'Enter a cancellation reason' using errcode='22023';end if;
 insert into public.mzs_service_draft_cancellations(draft_id,reason,actor_id) values(p_draft,btrim(p_reason),auth.uid()) on conflict(draft_id) do nothing;return p_draft;
end $$;
create function public.mzs_create_service_draft(p_id uuid,p_issuer uuid,p_customer uuid,p_spec jsonb) returns uuid language sql security invoker set search_path='' as $$select mzs_private.create_service_draft(p_id,p_issuer,p_customer,p_spec)$$;
create function public.mzs_issue_service_invoice(p_draft uuid) returns uuid language sql security invoker set search_path='' as $$select mzs_private.issue_service_invoice(p_draft)$$;
create function public.mzs_cancel_service_draft(p_draft uuid,p_reason text) returns uuid language sql security invoker set search_path='' as $$select mzs_private.cancel_service_draft(p_draft,p_reason)$$;
do $$declare f record;begin for f in select p.oid::regprocedure id from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','mzs_private') and p.proname in ('create_service_draft','mzs_create_service_draft','issue_service_invoice','mzs_issue_service_invoice','cancel_service_draft','mzs_cancel_service_draft') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.id);execute format('grant execute on function %s to authenticated',f.id);end loop;end $$;
create or replace function mzs_private.ops_external_number_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.mzs_lease_issuers where id=new.issuer_id for update;
 if not found then raise exception 'Unknown issuing entity';end if;
 if (tg_table_name<>'mzs_lease_invoices' and exists(select 1 from public.mzs_lease_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 (tg_table_name<>'mzs_booking_invoices' and exists(select 1 from public.mzs_booking_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 exists(select 1 from public.mzs_ops_external_sales_invoices where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) or
 (tg_table_name<>'mzs_service_invoices' and exists(select 1 from public.mzs_service_invoices where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number)))) or
 exists(select 1 from public.mzs_invoice_archive where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) then
 raise exception 'Invoice number already registered for this entity' using errcode='23505';end if;
 return new;
end $$;

create trigger z_service_number before insert on public.mzs_service_invoices for each row execute function mzs_private.ops_external_number_guard();
create table public.mzs_service_invoice_receipts(
 id uuid primary key,
 invoice_id uuid not null references public.mzs_service_invoices(id),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 received_on date not null check(received_on>=date '2000-01-01'),
 reference text not null check(length(btrim(reference)) between 3 and 200 and reference=btrim(reference) and reference !~ '[[:cntrl:]]'),
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index service_receipts_invoice_idx on public.mzs_service_invoice_receipts(invoice_id);
create index service_receipts_actor_idx on public.mzs_service_invoice_receipts(recorded_by);
create table public.mzs_service_invoice_receipt_reversals(
 receipt_id uuid primary key references public.mzs_service_invoice_receipts(id),
 reason text not null check(length(btrim(reason)) between 8 and 500 and reason=btrim(reason) and reason !~ '[[:cntrl:]]'),
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index service_receipt_reversals_actor_idx on public.mzs_service_invoice_receipt_reversals(recorded_by);
alter table public.mzs_service_invoice_receipts enable row level security;
alter table public.mzs_service_invoice_receipt_reversals enable row level security;
revoke all on public.mzs_service_invoice_receipts,public.mzs_service_invoice_receipt_reversals from public,anon,authenticated,service_role;
grant select on public.mzs_service_invoice_receipts,public.mzs_service_invoice_receipt_reversals to authenticated;
create policy service_receipts_admin_read on public.mzs_service_invoice_receipts for select to authenticated using((select public.is_admin()));
create policy service_receipt_reversals_admin_read on public.mzs_service_invoice_receipt_reversals for select to authenticated using((select public.is_admin()));
create function mzs_private.service_receipt_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Payment history is immutable; record a reversal instead' using errcode='42501';end $$;
revoke all on function mzs_private.service_receipt_immutable() from public,anon,authenticated,service_role;
create trigger service_receipts_immutable before update or delete on public.mzs_service_invoice_receipts for each row execute function mzs_private.service_receipt_immutable();
create trigger service_receipt_reversals_immutable before update or delete on public.mzs_service_invoice_receipt_reversals for each row execute function mzs_private.service_receipt_immutable();

-- These two private functions are the only write path. Invoice row locks serialize
-- concurrent receipts and reversals, including repeated requests from two tabs.
create function mzs_private.record_service_invoice_receipt(p_id uuid,p_invoice uuid,p_amount_cents bigint,p_received_on date,p_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.mzs_service_invoices;prior public.mzs_service_invoice_receipts;paid bigint;ref text:=btrim(p_reference);
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_invoice is null or p_amount_cents is null or p_amount_cents not between 1 and 100000000000 or p_received_on is null or p_received_on<date '2000-01-01' or p_received_on>(now() at time zone 'Europe/Madrid')::date or ref is null or length(ref) not between 3 and 200 or ref ~ '[[:cntrl:]]' then raise exception 'Check amount, payment date and reference' using errcode='22023';end if;
 select * into inv from public.mzs_service_invoices where id=p_invoice for update;
 if not found or inv.status<>'issued' or inv.currency<>'EUR' then raise exception 'Standalone invoice not found' using errcode='22023';end if;
 select * into prior from public.mzs_service_invoice_receipts where id=p_id;
 if found then
  if prior.invoice_id<>p_invoice or prior.amount_cents<>p_amount_cents or prior.received_on<>p_received_on or prior.reference<>ref then raise exception 'Request identifier already used for different payment details' using errcode='22023';end if;
  if exists(select 1 from public.mzs_service_invoice_receipt_reversals where receipt_id=p_id) then raise exception 'This payment was reversed; refresh before recording a replacement' using errcode='22023';end if;
  return p_id;
 end if;
 if exists(select 1 from public.mzs_service_invoice_receipts r where r.invoice_id=p_invoice and lower(r.reference)=lower(ref) and not exists(select 1 from public.mzs_service_invoice_receipt_reversals v where v.receipt_id=r.id)) then raise exception 'An active payment with this reference already exists' using errcode='22023';end if;
 select coalesce(sum(r.amount_cents),0) into paid from public.mzs_service_invoice_receipts r where r.invoice_id=p_invoice and not exists(select 1 from public.mzs_service_invoice_receipt_reversals v where v.receipt_id=r.id);
 if paid+p_amount_cents>inv.gross_cents then raise exception 'Payment exceeds the remaining invoice balance; refresh the invoice' using errcode='22023';end if;
 insert into public.mzs_service_invoice_receipts(id,invoice_id,amount_cents,received_on,reference,recorded_by) values(p_id,p_invoice,p_amount_cents,p_received_on,ref,auth.uid());
 return p_id;
end $$;
create function mzs_private.reverse_service_invoice_receipt(p_id uuid,p_invoice uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare prior_reason text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_invoice is null or p_reason is null or length(btrim(p_reason)) not between 8 and 500 or p_reason ~ '[[:cntrl:]]' then raise exception 'Enter a reversal reason of 8 to 500 characters' using errcode='22023';end if;
 perform 1 from public.mzs_service_invoices where id=p_invoice for update;
 if not found or not exists(select 1 from public.mzs_service_invoice_receipts where id=p_id and invoice_id=p_invoice) then raise exception 'Payment does not belong to this invoice' using errcode='22023';end if;
 select reason into prior_reason from public.mzs_service_invoice_receipt_reversals where receipt_id=p_id;
 if found then
  if prior_reason<>btrim(p_reason) then raise exception 'This payment was already reversed; refresh its history' using errcode='22023';end if;
  return p_id;
 end if;
 insert into public.mzs_service_invoice_receipt_reversals(receipt_id,reason,recorded_by) values(p_id,btrim(p_reason),auth.uid());
 return p_id;
end $$;
revoke all on function mzs_private.record_service_invoice_receipt(uuid,uuid,bigint,date,text),mzs_private.reverse_service_invoice_receipt(uuid,uuid,text) from public,anon,authenticated,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.record_service_invoice_receipt(uuid,uuid,bigint,date,text),mzs_private.reverse_service_invoice_receipt(uuid,uuid,text) to authenticated;
create function public.mzs_record_service_invoice_receipt(p_id uuid,p_invoice uuid,p_amount_cents bigint,p_received_on date,p_reference text)
returns uuid language sql security invoker set search_path='' as $$select mzs_private.record_service_invoice_receipt(p_id,p_invoice,p_amount_cents,p_received_on,p_reference)$$;
create function public.mzs_reverse_service_invoice_receipt(p_id uuid,p_invoice uuid,p_reason text)
returns uuid language sql security invoker set search_path='' as $$select mzs_private.reverse_service_invoice_receipt(p_id,p_invoice,p_reason)$$;
revoke all on function public.mzs_record_service_invoice_receipt(uuid,uuid,bigint,date,text),public.mzs_reverse_service_invoice_receipt(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_record_service_invoice_receipt(uuid,uuid,bigint,date,text),public.mzs_reverse_service_invoice_receipt(uuid,uuid,text) to authenticated;

create function public.mzs_service_invoice_receipt_source(p_invoice_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows jsonb;total bigint;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_invoice_ids is null or cardinality(p_invoice_ids) not between 1 and 100 or (select count(*) from public.mzs_service_invoices where id=any(p_invoice_ids))<>cardinality(p_invoice_ids) then raise exception 'Invalid standalone invoice selection';end if;
 select count(*) into total from public.mzs_service_invoice_receipts where invoice_id=any(p_invoice_ids);
 if total>10000 then raise exception 'Payment register too large for one selection';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.received_on,x.id),'[]'::jsonb) into rows from (
  select r.*,v.created_at reversed_at,v.recorded_by reversed_by,v.reason reversal_reason
  from public.mzs_service_invoice_receipts r left join public.mzs_service_invoice_receipt_reversals v on v.receipt_id=r.id where r.invoice_id=any(p_invoice_ids)
 ) x;
 return jsonb_build_object('invoice_ids',p_invoice_ids,'count',total,'rows',rows,'snapshot_at',statement_timestamp());
end $$;
revoke all on function public.mzs_service_invoice_receipt_source(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.mzs_service_invoice_receipt_source(uuid[]) to authenticated;
comment on table public.mzs_service_invoice_receipts is 'Administrator-recorded EUR receipts for already issued standalone invoices. Not bank synchronization. Original source status is unchanged.';
comment on table public.mzs_service_invoice_receipt_reversals is 'Permanent administrative reversals; not bank refunds. Original receipt and actor are retained.';
create or replace function public.mzs_ops_accountant_source(p_entity uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.mzs_lease_issuers where id=p_entity) then raise exception 'Unknown entity';end if;
 if (select count(*) from public.mzs_service_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_service_invoice_receipts r join public.mzs_service_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Standalone export scope too large';end if;
 if (select count(*) from public.mzs_invoice_archive where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_archive_invoice_receipts r join public.mzs_invoice_archive i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Imported export scope too large';end if;
 if (select count(*) from public.mzs_external_invoice_receipts r join public.mzs_ops_external_sales_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 or (select count(*) from public.mzs_ops_external_sales_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_lease_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_booking_invoices where issuer_id=p_entity)>3000 or
 (select count(*) from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity)>10000 or
 (select count(*) from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity)>10000 then raise exception 'Export scope too large';end if;
 select jsonb_build_object(
 'issuer',(select jsonb_build_object('id',id,'name',name) from public.mzs_lease_issuers where id=p_entity),
 'leases',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,contract_id,number,issued_on,total from public.mzs_lease_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,booking_id,number,issued_on,total,net_total,vat_total from public.mzs_booking_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'external',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,batch_id,issuer_id,number,issued_on,net_cents::numeric/100 net_total,vat_cents::numeric/100 vat_total,gross_cents::numeric/100 total,status from public.mzs_ops_external_sales_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'rent_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.invoice_id,p.amount,p.received_on,p.reference,p.reversed_at from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'guest_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.booking_id,p.amount,p.received_on,p.reference,p.receipt_type,p.reversed_at from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'external_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select r.id,r.invoice_id,r.amount_cents::numeric/100 amount,r.received_on,r.reference,v.created_at reversed_at from public.mzs_external_invoice_receipts r join public.mzs_ops_external_sales_invoices i on i.id=r.invoice_id left join public.mzs_external_invoice_receipt_reversals v on v.receipt_id=r.id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'imported',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select i.id,i.issuer_id,i.number,i.issued_on,i.gross_cents,i.source_paid_cents,i.source_open_cents,exists(select 1 from public.mzs_invoice_archive_exclusions e where e.invoice_id=i.id) excluded from public.mzs_invoice_archive i where i.issuer_id=p_entity) x),'[]'::jsonb),
 'imported_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select r.id,r.invoice_id,r.amount_cents::numeric/100 amount,r.received_on,r.reference,v.created_at reversed_at from public.mzs_archive_invoice_receipts r join public.mzs_invoice_archive i on i.id=r.invoice_id left join public.mzs_archive_invoice_receipt_reversals v on v.receipt_id=r.id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,draft_id,issuer_id,number,issued_on,net_cents::numeric/100 net_total,vat_cents::numeric/100 vat_total,gross_cents::numeric/100 total,status from public.mzs_service_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'service_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select r.id,r.invoice_id,r.amount_cents::numeric/100 amount,r.received_on,r.reference,v.created_at reversed_at from public.mzs_service_invoice_receipts r join public.mzs_service_invoices i on i.id=r.invoice_id left join public.mzs_service_invoice_receipt_reversals v on v.receipt_id=r.id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'snapshot_at',statement_timestamp()) into result;
 return result;
end $fn$;
revoke all on function public.mzs_ops_accountant_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_accountant_source(uuid) to authenticated;




commit;
