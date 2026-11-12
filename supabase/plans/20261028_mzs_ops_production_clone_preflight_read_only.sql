-- MZS Group / Production recovery preflight (28 October 2026).
-- READ-ONLY plan; never a migration or backup/restore command.
-- Run only after confirming intended Production project in Supabase UI.
-- Do not publish its output (release evidence may contain sensitive operational metadata).
begin transaction read only;

-- Database identity, scope and supported dependency availability.
select current_database() as database_name,
 current_setting('server_version') as postgres_version,
 pg_size_pretty(pg_database_size(current_database())) as database_size,
 to_regprocedure('public.is_admin()') is not null as has_admin_guard,
 to_regprocedure('auth.uid()') is not null as has_current_auth_id,
 to_regclass('public.profiles') is not null as has_profiles,
 to_regclass('public.mzs_estate_properties') is not null as has_physical_properties,
 (select count(*)::integer from pg_catalog.pg_tables
  where schemaname='public' and tablename like 'mzs_ops_pilot_%') as pilot_tables,
 (select count(*)::integer from pg_catalog.pg_views
  where schemaname='public' and viewname like 'mzs_ops_pilot_%') as pilot_views;

-- Check scheduled operations before cloning. Their execution can start on a
-- restored database BEFORE an operator has time to disable them.
-- Never read or export cron.command here: cron commands may contain secrets.
select extname as extension_name from pg_extension
 where extname in ('pg_cron','pg_net','wrappers') order by extname;
select count(*)::integer as scheduled_jobs,
 count(*) filter (where active)::integer as active_scheduled_jobs
 from cron.job;

-- Current baseline counts only; do not export private row contents.
select 'rental_bookings' as register,count(*)::bigint as row_count from public.rental_bookings
union all select 'mzs_booking_receipts',count(*) from public.mzs_booking_receipts
union all select 'mzs_booking_invoices',count(*) from public.mzs_booking_invoices
union all select 'mzs_lease_contracts',count(*) from public.mzs_lease_contracts
union all select 'mzs_lease_invoices',count(*) from public.mzs_lease_invoices
union all select 'mzs_capital_deals',count(*) from public.mzs_capital_deals
union all select 'mzs_capital_payments',count(*) from public.mzs_capital_payments
union all select 'mzs_owner_stay_requests',count(*) from public.mzs_owner_stay_requests
union all select 'mzs_estate_properties',count(*) from public.mzs_estate_properties
union all select 'mzs_estate_units',count(*) from public.mzs_estate_units
order by register;
commit;
