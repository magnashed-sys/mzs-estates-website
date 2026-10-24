-- Owner-approved Production draft preparation, beginning with December 2026 billing.
-- Does not issue, number or send invoices. Only activated contracts are processed.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('mzs-production-lease-drafts','15 5 * * *',
 $$select mzs_private.generate_lease_drafts((now() at time zone 'Europe/Amsterdam')::date)$$);
