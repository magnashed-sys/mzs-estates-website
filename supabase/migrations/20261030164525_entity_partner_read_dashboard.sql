begin;
set local lock_timeout='2s';
create table public.mzs_entity_partners (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete restrict,
 issuer_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(profile_id,issuer_id)
);
create index entity_partner_issuer on public.mzs_entity_partners(issuer_id);
alter table public.mzs_entity_partners enable row level security;
revoke all on public.mzs_entity_partners from public,anon,authenticated,service_role;
grant select on public.mzs_entity_partners to authenticated;
-- Grants are provisioned by an audited migration, never by the partner client.
create policy entity_partner_self_read on public.mzs_entity_partners for select to authenticated
 using ((profile_id=(select auth.uid()) and is_active and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active)) or (select public.is_admin()));

create function mzs_private.can_read_partner_entity(p_entity uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active)
 and (public.is_admin() or exists(select 1 from public.mzs_entity_partners g where g.profile_id=auth.uid() and g.issuer_id=p_entity and g.is_active));
$$;
revoke all on function mzs_private.can_read_partner_entity(uuid) from public,anon,authenticated,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.can_read_partner_entity(uuid) to authenticated;

create function mzs_private.partner_entities()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name) order by i.name),'[]'::jsonb)
 from public.mzs_lease_issuers i where mzs_private.can_read_partner_entity(i.id);
$$;
revoke all on function mzs_private.partner_entities() from public,anon,authenticated,service_role;
grant execute on function mzs_private.partner_entities() to authenticated;
create function public.mzs_partner_entities() returns jsonb language sql stable security invoker set search_path='' as $$select mzs_private.partner_entities()$$;
revoke all on function public.mzs_partner_entities() from public,anon,authenticated,service_role;
grant execute on function public.mzs_partner_entities() to authenticated;

create function mzs_private.partner_finance(p_entity uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare result jsonb;
begin
 if mzs_private.can_read_partner_entity(p_entity) is distinct from true then raise exception 'Entity access denied' using errcode='42501';end if;
 if (select count(*) from public.mzs_service_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_service_invoice_receipts r join public.mzs_service_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Standalone export scope too large';end if;
 if (select count(*) from public.mzs_invoice_archive where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_archive_invoice_receipts r join public.mzs_invoice_archive i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Imported export scope too large';end if;
 if (select count(*) from public.mzs_external_invoice_receipts r join public.mzs_ops_external_sales_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 or (select count(*) from public.mzs_ops_external_sales_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_lease_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_booking_invoices where issuer_id=p_entity)>3000 or
 (select count(*) from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity)>10000 or
 (select count(*) from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity)>10000 then raise exception 'Export scope too large';end if;
 if (select count(*) from public.mzs_service_credit_notes where issuer_id=p_entity)>3000 then raise exception 'Credit scope too large';end if;
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
 'credit_notes',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,invoice_id,issuer_id,customer_id,number,issued_on,net_cents,vat_cents,gross_cents,reason from public.mzs_service_credit_notes where issuer_id=p_entity) x),'[]'::jsonb),
 'snapshot_at',statement_timestamp()) into result;
 if (select count(*) from public.mzs_ops_expense_drafts where legal_entity_id=p_entity)>3000 or
    (select count(*) from public.mzs_accountancy_documents where issuer_id=p_entity)>3000 or
    (select count(*) from public.mzs_accountancy_supplier_payments where issuer_id=p_entity)>10000 or
    (select count(*) from public.mzs_capital_deals where entity_id=p_entity)>1000 or
    (select count(*) from public.mzs_capital_instalments i join public.mzs_capital_deals d on d.id=i.deal_id where d.entity_id=p_entity)>10000 or
    (select count(*) from public.mzs_capital_payments p join public.mzs_capital_instalments i on i.id=p.instalment_id join public.mzs_capital_deals d on d.id=i.deal_id where d.entity_id=p_entity)>10000 then
   raise exception 'Partner scope too large; contact administrator';
 end if;
 return result || jsonb_build_object(
 'costs',coalesce((select jsonb_agg(to_jsonb(x) order by x.invoice_date desc,x.id) from (
  select d.id,d.invoice_date,d.supplier_invoice_number,d.description,d.category,d.currency,d.net_cents,d.vat_cents,d.gross_cents,d.status,
   p.name property_name,coalesce(v.review_status,'pending') review_status
  from public.mzs_ops_expense_drafts d left join public.mzs_estate_properties p on p.id=d.property_id
  left join public.mzs_accountancy_cost_reviews v on v.draft_id=d.id and exists(select 1 from public.mzs_accountancy_years y where y.id=v.year_id and y.issuer_id=p_entity and y.fiscal_year=extract(year from d.invoice_date))
  where d.legal_entity_id=p_entity
 ) x),'[]'::jsonb),
 'supplier_payments',coalesce((select jsonb_agg(to_jsonb(x) order by x.paid_on desc,x.id) from (
  select r.id,r.draft_id,r.amount_cents,r.paid_on,r.reference,v.created_at reversed_at
  from public.mzs_accountancy_supplier_payments r join public.mzs_ops_expense_drafts d on d.id=r.draft_id
  left join public.mzs_accountancy_supplier_payment_reversals v on v.payment_id=r.id
  where r.issuer_id=p_entity and d.legal_entity_id=p_entity
 ) x),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(to_jsonb(x) order by x.fiscal_year desc,x.document_date desc,x.id) from (
  select id,fiscal_year,title,category,period_label,document_date,review_status from public.mzs_accountancy_documents where issuer_id=p_entity
 ) x),'[]'::jsonb),
 'loan_instalments',coalesce((select jsonb_agg(to_jsonb(x) order by x.due_date,x.id) from (
 select i.id,i.deal_id,i.kind,i.period_label,i.due_date,i.amount,d.currency,d.title from public.mzs_capital_instalments i join public.mzs_capital_deals d on d.id=i.deal_id where d.entity_id=p_entity
 ) x),'[]'::jsonb),
 'loan_payments',coalesce((select jsonb_agg(to_jsonb(x) order by x.paid_on,x.id) from (
 select p.id,p.instalment_id,p.amount,p.paid_on,p.reference,p.is_void,d.currency,d.title from public.mzs_capital_payments p join public.mzs_capital_instalments i on i.id=p.instalment_id join public.mzs_capital_deals d on d.id=i.deal_id where d.entity_id=p_entity
 ) x),'[]'::jsonb),
 'loans',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (
  select id,title,direction,lender,borrower,principal,annual_rate,currency,start_date,maturity_date,status,review_state
  from public.mzs_capital_deals where entity_id=p_entity
 ) x),'[]'::jsonb));
end $fn$;
revoke all on function mzs_private.partner_finance(uuid) from public,anon,authenticated,service_role;
grant execute on function mzs_private.partner_finance(uuid) to authenticated;
create function public.mzs_partner_finance(p_entity uuid) returns jsonb language sql stable security invoker set search_path='' as $$select mzs_private.partner_finance(p_entity)$$;
revoke all on function public.mzs_partner_finance(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_partner_finance(uuid) to authenticated;
commit;
