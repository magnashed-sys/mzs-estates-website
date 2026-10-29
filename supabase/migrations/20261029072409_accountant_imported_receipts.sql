begin;
set local lock_timeout='2s';
create or replace function public.mzs_ops_accountant_source(p_entity uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.mzs_lease_issuers where id=p_entity) then raise exception 'Unknown entity';end if;
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
 'snapshot_at',statement_timestamp()) into result;
 return result;
end $fn$;
revoke all on function public.mzs_ops_accountant_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_accountant_source(uuid) to authenticated;


commit;
