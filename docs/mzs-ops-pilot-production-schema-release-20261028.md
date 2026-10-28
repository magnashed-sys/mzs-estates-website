# MZS Group — Production pilot schema release (default OFF)

**Release scope:** only the isolated Property Operations pilot schema and eight indexes. The production website already has the dormant routes from merged PR #144. This does **not** release the broad financial/accountancy PR #143 or Staging-only PR #145.

## Owner authorization & recovery evidence
- On 28 October 2026 the owner confirmed that the Production database backup is ready and authorized moving to Production.
- The assistant **has not independently retrieved a backup checkpoint or demonstrated a successful restore**. A ready backup is not the same as a verified restore. Record actual snapshot, point-in-time recovery availability and retention privately.
- Before schema migration: Production PostgreSQL 17.11 healthy; two registered physical properties, 22 units, 32 rental bookings, 18 booking receipts, 20 lease contracts, four Capital deals, 16 Capital payments and six owner-stay requests, and **zero** `mzs_ops_pilot_*` tables.
- The existing Production Vercel deployment is `dpl_AmrnMDetBNMgvceyZYvngdqstKxZ` at Git commit `68037438bcca349396f743f3e8c96e38a4a766d3`, READY. Keep a known-good deployment available.
- PostgreSQL in Production has one active `pg_cron` lease-draft job. Do **not** clone Production into a live environment without preventing copied scheduled jobs and external side effects from their first instant.

## Atomic default-OFF migration
The migration `supabase/migrations/20261028161000_mzs_ops_isolated_pilot_production_off.sql` consists of the exact Staging-verified core DDL and eight additional indexes in one transaction, with no seed or activation event. It adds five `mzs_ops_pilot_*` tables, an invoker-security directory view and private helper functions. Existing bookings, leases, invoices, owner stays, Capital and accounting tables are never altered.

- Execute in **Production only** with a unique applied migration ledger entry after tests on exact commit and a rollback-only Production SQL rehearsal.
- Confirm every new table has row-level security, no anonymous reads, and no direct authenticated UPDATE/DELETE.
- Confirm `runs=0`, `run_events=0`, `access_events=0`, `visits=0`, `tickets=0`, with zero allowed staff.
- Confirm `MZS_OPS_PRODUCTION_PILOT_ENABLED` remains missing/false and no Production release SHA allowlist is set. The routes return not found even for logged-in administrators.
- Reconcile legacy business register counts after migration; investigate any unexplained change.
- Retain production database migration in Git, audit logs and CI evidence. No public presentation of actual client UUIDs or financial records.

## STOP / rollback
For unexpected access, financial side effects or application errors, stop any enabled pilot run **at the database level first**; revoke its access event and set the server flag OFF. The first schema release must have no runs or grants and requires no such action.

If application routing is impaired, revert to the recorded previous known-good Vercel deployment after verifying which deployment is active. Do not drop newly created tables on an active Production system simply to roll back: they are additive and empty. A full database restore can erase legitimate intervening transactions and must be a separately authorized, incident-specific last resort.

## What this does not authorize
No Production staff access, Catherine activation, copy of Production data into Staging, historical invoice imports, accountant ZIPs, expense mutation, work-order dispatch, external emails or financial postings. A future pilot activation must explicitly verify the existing account and physical-property assignment and undergo authenticated admin/staff, revoked-user, wrong-object and mobile acceptance.
