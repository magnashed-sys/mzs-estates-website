-- MZS GROUP / PROPERTY OPERATIONS — READ-ONLY PILOT PREFLIGHT
-- Preparation only. NOT a migration. Never run against a different project by mistake.
-- Run against the explicitly selected Supabase project before AND after a release.
-- Save the results privately with the release ticket; do not commit customer counts.
-- Changes to legacy counts between snapshots need operator reconciliation.
begin transaction read only;

-- 1. Environment and pilot schema footprint; verify intended project in the Supabase UI.
select current_database() as database_name,
       current_setting('server_version') as postgres_version,
       (select count(*) from pg_catalog.pg_tables
         where schemaname='public' and tablename like 'mzs_ops_%') as property_ops_tables,
       (select count(*) from pg_catalog.pg_views
         where schemaname='public' and viewname like 'mzs_ops_%') as property_ops_views,
       (select count(*) from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r'
           and c.relname like 'mzs_ops_%' and c.relrowsecurity) as property_ops_tables_with_rls;

-- 2. Snapshot exact registry counts, not identifiers or customer details.
-- Compare PRE and POST in one controlled change window, allowing known user activity.
select 'rental_bookings' as register,count(*)::bigint as record_count from public.rental_bookings
union all select 'mzs_booking_invoices', count(*) from public.mzs_booking_invoices
union all select 'mzs_booking_receipts', count(*) from public.mzs_booking_receipts
union all select 'mzs_lease_contracts', count(*) from public.mzs_lease_contracts
union all select 'mzs_lease_invoices', count(*) from public.mzs_lease_invoices
union all select 'mzs_lease_payments', count(*) from public.mzs_lease_payments
union all select 'mzs_capital_deals', count(*) from public.mzs_capital_deals
union all select 'mzs_capital_payments', count(*) from public.mzs_capital_payments
union all select 'mzs_owner_stay_requests', count(*) from public.mzs_owner_stay_requests
union all select 'mzs_estate_properties', count(*) from public.mzs_estate_properties
union all select 'mzs_estate_units', count(*) from public.mzs_estate_units
order by register;

-- 3. All new tables must have RLS; anonymous access and direct edits should remain denied.
-- Before a Production schema release this returns no rows (expected).
select c.relname as property_ops_table,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon',c.oid,'SELECT') as anonymous_select,
       has_table_privilege('authenticated',c.oid,'UPDATE') as direct_authenticated_update,
       has_table_privilege('authenticated',c.oid,'DELETE') as direct_authenticated_delete
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'mzs_ops_%'
order by c.relname;

commit;
