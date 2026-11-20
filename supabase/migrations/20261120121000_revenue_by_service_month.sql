create function mzs_private.revenue_months(amount numeric, start_on date, end_exclusive date, monthly_rent boolean)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;
begin
 if start_on is null or end_exclusive is null or end_exclusive<=start_on then raise exception 'Missing or invalid revenue period'; end if;
 with months as (
 select m::date first_day,(m+interval '1 month')::date next_month from generate_series(date_trunc('month',start_on::timestamp), (end_exclusive-1)::timestamp,interval '1 month') m
 ), weights as (
 select first_day,(least(end_exclusive,next_month)-greatest(start_on,first_day))::numeric /
 (case when monthly_rent then next_month-first_day else 1 end) weight from months
 ), running as (
 select first_day,round(amount*100*sum(weight) over(order by first_day)/sum(weight) over()) cumulative from weights
 ), portions as (
 select first_day,cumulative-lag(cumulative,1,0::numeric) over(order by first_day) cents from running
 )
 select jsonb_agg(jsonb_build_object('month',first_day,'cents',cents) order by first_day) into result from portions;
 return result;
end $$;
revoke all on function mzs_private.revenue_months(numeric,date,date,boolean) from public,anon;
grant execute on function mzs_private.revenue_months(numeric,date,date,boolean) to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.mzs_ops_accountant_source(p_entity uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.mzs_lease_issuers where id=p_entity) then raise exception 'Unknown entity';end if;
 if (select count(*) from public.mzs_service_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_service_invoice_receipts r join public.mzs_service_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Standalone export scope too large';end if;
 if (select count(*) from public.mzs_invoice_archive where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_archive_invoice_receipts r join public.mzs_invoice_archive i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 then raise exception 'Imported export scope too large';end if;
 if (select count(*) from public.mzs_external_invoice_receipts r join public.mzs_ops_external_sales_invoices i on i.id=r.invoice_id where i.issuer_id=p_entity)>10000 or (select count(*) from public.mzs_ops_external_sales_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_lease_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_booking_invoices where issuer_id=p_entity)>3000 or
 (select count(*) from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity)>10000 or
 (select count(*) from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity)>10000 then raise exception 'Export scope too large';end if;
 if (select count(*) from public.mzs_service_credit_notes where issuer_id=p_entity)>3000 then raise exception 'Credit scope too large';end if;
 select jsonb_build_object(
 'issuer',(select jsonb_build_object('id',id,'name',name) from public.mzs_lease_issuers where id=p_entity),
 'leases',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select i.id,i.issuer_id,i.contract_id,i.number,i.issued_on,i.total,
 mzs_private.revenue_months(i.total,coalesce((i.payload#>>'{snapshot,covered_from}')::date,d.period_start),coalesce((i.payload#>>'{snapshot,covered_to}')::date,d.period_end)+1,true) as revenue_months
 from public.mzs_lease_invoices i join public.mzs_lease_invoice_drafts d on d.id=i.draft_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select i.id,i.issuer_id,i.booking_id,i.number,i.issued_on,i.total,i.net_total,i.vat_total,
 mzs_private.revenue_months(i.total,coalesce((i.payload->>'booking_check_in')::date,b.check_in),coalesce((i.payload->>'booking_check_out')::date,b.check_out),false) as revenue_months
 from public.mzs_booking_invoices i join public.rental_bookings b on b.id=i.booking_id where i.issuer_id=p_entity) x),'[]'::jsonb),
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
 return result;
end $function$
;
alter table public.mzs_accountancy_income_allocations drop constraint mzs_accountancy_income_allocations_pkey,
 add primary key(year_id,source,invoice_id);
CREATE OR REPLACE FUNCTION mzs_private.validate_income_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare y public.mzs_accountancy_years; invoice jsonb; p public.mzs_accountancy_projects;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active Group Admin required' using errcode='42501';end if;
 select * into strict y from public.mzs_accountancy_years where id=new.year_id;
 select value into invoice from jsonb_array_elements(public.mzs_ops_accountant_source(y.issuer_id)->new.source) where value->>'id'=new.invoice_id::text;
 if invoice is null or invoice->>'issuer_id'<>y.issuer_id::text or not exists(select 1 from jsonb_array_elements(coalesce(invoice->'revenue_months',jsonb_build_array(jsonb_build_object('month',invoice->>'issued_on')))) m where left(m->>'month',4)=y.fiscal_year::text) then raise exception 'Invoice does not belong to this entity and year';end if;
 if new.property_id is not null and not exists(select 1 from public.mzs_ops_property_entity_links l where l.property_id=new.property_id and l.legal_entity_id=y.issuer_id and l.effective_from<=coalesce((select min((m->>'month')::date) from jsonb_array_elements(invoice->'revenue_months') m where left(m->>'month',4)=y.fiscal_year::text),(invoice->>'issued_on')::date) and (l.effective_until is null or l.effective_until>=coalesce((select min((m->>'month')::date) from jsonb_array_elements(invoice->'revenue_months') m where left(m->>'month',4)=y.fiscal_year::text),(invoice->>'issued_on')::date))) then raise exception 'Property has no dated association with this entity';end if;
 if new.project_id is not null then
  select * into strict p from public.mzs_accountancy_projects where id=new.project_id;
  if p.year_id<>y.id or p.property_id is distinct from new.property_id then raise exception 'Project does not match the income scope';end if;
 end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;end if;
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $function$
;