-- Apply ONLY to MZS Staging (senonkpxdtlhyhrubicg) after the lease migration.
-- Production scheduling requires a separately approved release and cutover.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('mzs-staging-lease-drafts','15 5 * * *',
 $$select mzs_private.generate_lease_drafts((now() at time zone 'Europe/Amsterdam')::date)$$);
