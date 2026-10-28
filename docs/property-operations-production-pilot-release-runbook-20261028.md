# MZS Group — Property Operations Production Pilot: release and recovery runbook

**Status:** PREPARATION / NO-GO. **No Production changes are authorized by this document.**
**Source:** Draft PR [#143](https://github.com/magnashed-sys/mzs-estates-website/pull/143). Do not merge this entire feature PR as the first release.
**Focus:** existing Production identities, one explicitly confirmed physical property, synthetic staff visit and maintenance workflow only.

## 1. Verified baseline (read-only, 28 October 2026)

- MZS Production Supabase `ptrnjzmcehrhbsfxntgw`: active/healthy; PostgreSQL 17.11; two physical properties, 22 units, **no `mzs_ops_*` tables or views**.
- MZS Staging Supabase `senonkpxdtlhyhrubicg`: active/healthy; PostgreSQL 17.11; two physical properties, 22 units, **19 `mzs_ops_*` tables with RLS and two directory views**.
- All 19 new Staging tables have RLS, no anonymous SELECT and no direct authenticated UPDATE/DELETE per read-only privilege inspection.
- Production and Staging have **different application data and auth populations**. Do not copy Production accounts, cookies, signing keys, personal documents or balances into Staging.
- The Draft Preview is restricted to exact Staging origin. Direct admin Staff and Expense route guards now fail closed before data queries outside Preview. Regression tests cover these direct routes and 18 additional inline server guards.
- Live authenticated end-to-end user acceptance with a test employee is **not yet evidenced**. Existing UUID and CI fixes are not a Production-pilot approval.

## 2. First-pilot scope: explicit exclusions

**Allowed only after separate approval:** Group Admin and one verified existing active client/partner, assigned to one identified property; synthetic work visits, corrections, reviews and maintenance tickets; optionally non-sensitive synthetic image and an internal-only maintenance budget.

**Not allowed in the first pilot:** real supplier expenses or documents; invoices, accountant exports, bank receipts, payroll, loans, existing rental contracts, bookings, owner stays, customer emails, vendor dispatch, actual customer photographs or personal messages. No role promotion to admin, no access to other objects, no accidental second profile creation.

A reviewed 60-minute billable **candidate** remains a candidate, never earned income, cash, VAT, wage or issued charge.

## 3. Required pilot isolation design — NOT IMPLEMENTED

Use **dedicated pilot operational tables** rather than inserting synthetic trials into real cost, timesheet or financial sources. Proposed independently reviewed schema slice:

- `mzs_ops_pilot_runs`: immutable run UUID, purpose, enabled flag (initially FALSE), owner/approval, start/stop and retention state; the database-side flag must act as an immediate kill switch.
- `mzs_ops_pilot_access` or append-only scope events: authenticated account UUID and exactly one verified property UUID, grant/revoke history, explicit administrator evidence. Client/partner role remains unchanged.
- `mzs_ops_pilot_visits`, `mzs_ops_pilot_corrections`, `mzs_ops_pilot_reviews`, `mzs_ops_pilot_tickets`, `mzs_ops_pilot_ticket_events` (and optional private pilot photo metadata): every row carries immutable `pilot_run_id` and verified property association.
- Every RLS policy and database trigger must require the **enabled** run, active allowlisted account, live property scope, and matching run/property for child records. The server also requires exact Production project URL, `VERCEL_ENV=production` and a default-OFF server flag, but **client-side flags or environment variables alone are insufficient**.
- Pilot data is visible only in explicitly labelled `PILOT — TESTGEGEVENS` views. All existing production invoices, financial cockpits, accountant exports, staff/maintenance registers and booking/capital queries must exclude these tables by construction. No copying/merging pilot entries into live books.
- Pilot photos, if enabled later, must use a separate private bucket, short-lived scoped download and agreed EXIF/malware/retention handling. Until these controls are accepted, disable photos.
- End of pilot: disable both the database run and server flag; retain immutable audit and archive/void records under an agreed retention policy, never silently delete.

**Do not create these Production tables or flags from this document.** Write and test a dedicated additive SQL migration and its access-control tests first, then request explicit approval for applying it.

## 4. Release stages, each with its own owner approval

| Stage | Change | Release condition |
| --- | --- | --- |
| P0 — now | GitHub review, Preview test, read-only inventory, backup/restore plan | No Production mutation |
| P1 — schema OFF | Narrow additive pilot tables, RLS, private Storage only if approved | Migration on restored Production clone passes; owner separately authorizes actual Production DDL |
| P2 — UI OFF | Targeted Staff/Maintenance pilot code on separately reviewed release branch, server flag FALSE | CI, security, authentication, origin checks and prior Production regression suite pass; owner authorizes Production code deployment |
| P3 — pilot ON | Database run enabled and exact existing account + verified property allowlisted; server flag enabled | Negative RLS tests and backups validated; owner authorizes pilot activation separately |
| P4 — closure | Revoke grant, set database run disabled, disable server flag; reconcile and retain audit | Owner accepts closure and retention |

The 12 Staging migration *source* files have historical applied versions that differ in the migration ledger. Do **not** use Staging timestamps as evidence they were run in Production. For the first narrow pilot, create a new dedicated **Production-specific** migration set rather than blindly replaying all accounting migrations.

## 5. Non-negotiable preflight before any Production change

1. Freeze exact Git SHAs for `main`, narrow release branch and CI; record Vercel Production deployment ID and available rollback candidate. Verify no branch protection or default deployment will unintentionally promote a Draft commit.
2. Record the Production project ID; compare its current schema/migration ledger to a newly restored **Production-like clone**. Never run DDL on Production as a rehearsal. Ensure all dependent properties/profiles and schema permissions exist on the clone.
3. Confirm recent Production backup/PITR availability, the **last successful recovery point, restore exercise evidence, RPO/RTO and responsible operator**. A backup list without a successful restore test is a NO-GO.
4. Execute [the read-only preflight SQL](../supabase/plans/20261028_property_operations_production_pilot_preflight.sql) against the selected target. Keep outputs privately with the release; do not commit live counts or personal data.
5. On the clone, test: anonymous, inactive client, ordinary unassigned client, assigned user, another property, revoked user, admin. Test direct Supabase Data API in addition to UI; verify all parent/child records enforce `pilot_run_id`.
6. Test simultaneous access, stale JWT after revocation, incorrect UUID, manipulated property IDs, absent/mismatched Production DB, feature flag disabled, exception paths, direct URLs and expired private photo links. No existing source table may change.
7. Scan new SQL for SECURITY DEFINER/default public EXECUTE grants, RLS, Storage policies and cross-schema references; inspect Supabase advisors. Record differences and retry the cloned rehearsal if a migration changes.

**GO only if all gates pass and the owner authorizes the named stage.** Otherwise stop; do not infer approval from green CI or READY deployments.

## 6. After-release verification (only in a separately authorized release window)

- Keep run/feature flag **OFF** immediately after additive schema deployment. Re-run the read-only SQL and compare registry counts against the just-captured baseline, accounting for legitimate concurrent user writes.
- Confirm there are no pilot grants or operational rows by default. Check RLS metadata, no anon access, no direct authenticated UPDATE/DELETE, private bucket configuration, app authentication and no unexpected finance side effects.
- When and only when pilot activation is explicitly approved, grant one named existing account to one administrator-verified property; exercise synthetic workflow and immediate revocation.
- Record request IDs, release SHA, database migration versions, actor permissions, test run UUID, relevant logs and exit decision privately. Do not store account UUIDs or customer evidence in public GitHub.

## 7. Stop/rollback procedure

**Trigger:** unexpected access, cross-property visibility, real financial side effect, missing private evidence, broken existing workflow, nonrecoverable export discrepancy, RLS bypass, or failing monitoring/CI.

1. **Contain immediately at the data layer:** disable the pilot run via the dedicated administrator-controlled database kill switch and append a grant revocation. Confirm an already signed-in user cannot SELECT, INSERT, request signed URLs or create related records. The server flag should also be OFF; a Vercel environment-variable change alone may require redeployment and is **not** the emergency isolation mechanism.
2. **Stop the application entry point:** deploy/restore the previously recorded known-good Production build using the reviewed Vercel rollback path; verify old logins, original bookings and Financial Cockpit. Do not promote the Draft Preview.
3. **Preserve evidence:** retain audit, pilot rows and logs under the agreed policy. No blind DROP/TRUNCATE and no manual rewrite of immutable events.
4. **Reconcile** core register counts and recent business events using the read-only preflight plus event-level checks for the release window; compare invoices, bookings, owner stays, contracts, capital and payments.
5. **Database restore is last resort**, not routine rollback of additive schema. A full point-in-time restore can discard legitimate user activity after the recovery point. Require an incident-specific impact assessment and a separately authorized recovery action before restoring.
6. Document incident and root cause; pilot stays OFF until fresh review, retest and explicit approval.

## 8. Outstanding NO-GO items

- Implement and database-test segregated pilot tables with `pilot_run_id`, immediate DB-level disable and strict access allowlist.
- Create a selectively deployable Production-specific migration and narrow UI release PR; do not merge #143 wholesale.
- Complete signed-in desktop/mobile Staff, Admin and revoked-user acceptance.
- Demonstrate backup restoration; decide photo privacy, retention and recovery ownership.
- Confirm the specific property and responsibilities of any intended existing client, including Catherine, without publishing identifiers.

**Final rule:** nothing in this runbook authorizes any Production schema change, deployment, account/grant change, data import, invoice or email.
