# MZS Group — Production backup, clone isolation and release gate

**Prepared:** 28 October 2026  
**Status:** NO-GO for Production schema changes. This document itself makes no Production changes.

## Current verified state

- Repository: `magnashed-sys/mzs-estates-website`.
- Code-only isolated pilot base is on `main` (PR #144), **Production pilot disabled** by an unset server flag; no active run or account scopes.
- Full financial Property Operations branch (Draft PR #143) must stay separate; accountant exports and live financial posting are **not** in the initial pilot release.
- Narrow SQL / index hardening is applied **Staging only** in Draft PR #145; five pilot tables with RLS, one narrow view and eight FK indexes. Role-based rollback test passed, and Staging registers remained empty.
- Read-only Production preflight (SQL under `supabase/plans/20261028_mzs_ops_production_clone_preflight_read_only.sql`): two properties, 22 units, 32 bookings, 20 rental contracts, 18 booking receipt records, four capital dossiers, 16 capital payment records and six owner-stay requests; zero new `mzs_ops_*` tables. These counts are evidence snapshots, **not** backups.
- **Important unexpected operational dependency:** Supabase Production has `pg_cron` installed, **one active job**, named `mzs-production-lease-drafts` (schedule `15 5 * * *`). Its task body was not exported. This job must be reviewed before making a production-data clone.
- The available Supabase connection does not expose a list of recoverable backups or a safe restore-to-new-project action. **Backup existence, age, integrity and successful independent restoration have NOT been verified.**

## Backup/restore verification — manual owner/operator gate

1. Open **Supabase Dashboard → MZS Production → Database → Backups**. Verify that a usable physical backup exists, its date/time and intended retention; if using PITR, verify the earliest/latest recovery points. Capture evidence privately, never in public GitHub or chat messages containing credentials.
2. In **Restore to a New Project** (if available on the project plan), review the proposed new project, its region and estimated cost. **Do not start it until isolated-job controls below are agreed**. A direct restore to the active Production project is NOT an acceptable test.
3. **Clone isolation is mandatory before triggering any restore**. Supabase states that a physical restore to a new project includes Auth data, roles, root encryption key and SQL extensions; scheduled jobs and extensions can begin running immediately on a restored clone. Storage files, Edge Functions, Auth settings and API keys require separate treatment. The new clone must not become another user-facing MZS website.
4. Because `mzs-production-lease-drafts` is active, choose a restore method proven to prevent external effects from the first instant, not merely a promise to disable jobs after the clone starts. Preferred safer rehearsal if immediate job quarantine cannot be guaranteed: create an isolated logical restore with cron and external side-effect functionality excluded or disabled **before** the clone is available to run it. This rehearses schema/data recovery, but does not alone prove provider physical-backup restoration.
5. Confirm both Postgres roles and RLS; disable any SMTP/notification, scheduled invoice generation, automations, webhooks and outbound calls in the rehearsal environment. Prevent production cookies, signing keys and OAuth callbacks from being shared with the clone. Restrict access to authorized administrators and enforce data retention/GDPR handling.
6. Restore and validate *without modifying Production*: inspect a fixed point-in-time snapshot, compare legacy register counts, run the separate pilot migration in the clone, test access denial, and exercise the database-only terminal stop. Verify logs and record the recovery checkpoint and target RPO/RTO.
7. Treat any missing or failed backup proof, active external-effect jobs, inaccessible restore test or unexpected existing-data mutation as **NO-GO** for Production DDL.

## Review-only candidate migration

`supabase/plans/20261028_mzs_ops_pilot_production_candidate_review_only.sql` is **NOT** executable authorization, and is deliberately outside `supabase/migrations/`. The candidate is derived exactly from the Staging-tested table and FK-index SQL. It contains only additive pilot structures (five tables, one view, eight secondary indexes), no initial access grants or inserted pilot rows.

Before actual Production release:
- review every SECURITY DEFINER, default function EXECUTE grant, row policy, role and property dependency in the proposed Production-specific migration;
- confirm backup recovery and clone dry-run evidence;
- record the exact target project/branch/deployment and protected `main` SHA;
- obtain separate approval for Production schema deployment with default OFF, then verify the five tables remain empty and existing registers unchanged;
- obtain **another separate approval** to enable the pilot for a *named verified existing account* and *one explicitly identified physical property*;
- leave supplier invoices, payment events, bank reconciliations, Capital and accountant exports disabled.

## Safe stop and fallback

- When enabled in a future release, terminate the database pilot run first, revoke the worker's scope and disable the server flag. Since app environment-variable changes can require redeployment, **database stop is the immediate kill switch**.
- Restore the known-good Vercel Production deployment only after reviewing the rollback target and app compatibility. Do not drop the added pilot tables as an emergency first response.
- Keep all append-only evidence and reconcile bookings, lease contracts, receipts, Capital and owner stays against the baseline.
- Full database/PITR restoration is **last resort** and can lose legitimate intervening writes; approve separately only during an incident with a specific recovery point.

## Official Supabase references

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/clone-project
- https://supabase.com/docs/guides/deployment/going-into-prod

**Conclusion:** The reversible Staging proof is complete; the independent, clean Production backup-restoration proof and full signed-in browser acceptance remain required. Until those are evidenced, do not apply SQL to Production or enable client accounts such as Catherine.
