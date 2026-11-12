# MZS Group — Isolated Property Operations pilot: Staging acceptance

**28 October 2026. Staging only. Draft PR #145. No Production database migration, live account grants, pilot activation, real documents or invoices.**

## Environment and source
- GitHub base: PR #144 code-only release is already on `main`, with the pilot **default OFF** in Production.
- Draft PR #143 remains separate for broad financial, accountancy and operational workflows.
- Applied to isolated MZS Staging Supabase project `senonkpxdtlhyhrubicg`:
  1. `mzs_ops_isolated_pilot_staging`: five `mzs_ops_pilot_*` tables, one scoped security-invoker view, live grant/revoke journals and trigger-enforced terminal kill switch.
  2. `mzs_ops_pilot_fk_indexes_staging`: eight additive FK-covering indexes.
- Both migrations ran **Staging only** after exact-head full GitHub CI (unit/database tests, build, TS and security) passed.
- A branch-scoped Vercel **Preview-only** environment now supplies exact MZS Staging URL, Staging publishable key and `MZS_OPS_STAGING_PILOT_ENABLED=true`. No Production variable changed.
- Production uses a separate exact URL and requires an **absent/unset** `MZS_OPS_PRODUCTION_PILOT_ENABLED` flag and exact authorized release SHA; therefore no Production route or mutation is enabled.

## Post-migration RLS and data
- All **five** new pilot tables have RLS enabled.
- None grants anonymous SELECT or direct authenticated UPDATE/DELETE.
- Active pilotruns: **0**; run activation journal: **0**; staff grants: **0**; visits: **0**; tickets: **0**; private directory views: **1**.
- Staging Supabase Security Advisor reported **0 new pilot findings**.
- Performance Advisor: initial eight missing-FK-index findings corrected. Remaining pilot-specific informational **unused_index** notices are expected on entirely empty tables and must not be confused with new missing indexes.
- Existing Staging financial/property tables are separate from pilot tables; this migration did not insert any customer, lease, billing, booking, Capital or bank entries.

## Role-enforced acceptance test

The installed SQL schema was exercised against the actual MZS Staging PostgreSQL database in a **single rollback-only transaction** using existing active Staging admin/client roles, without copying or displaying personally identifiable identifiers.

Scenarios accepted:
1. Active Group Admin created one synthetic run, explicitly activated it and granted exactly one Staging client.
2. Granted user saw exactly one property through the narrow directory and created a synthetic 45-minute visit and fictional maintenance ticket.
3. A manipulated cross-property visit was denied by the database.
4. A different active, unassigned Staging client saw zero pilot properties and zero pilot visits.
5. Grant revocation immediately removed the former worker's pilot property and visit visibility.
6. Administrator appended terminal deactivation; all source changes, including the grants and synthetic records, were rolled back.

**After rollback:** all five pilot tables again contained **zero records**. The RLS fixture tests in GitHub additionally cover duplicate grant, inactive worker, private full-property denial, wrong object, direct UPDATE/DELETE refusal and reactivation denial.

## Authenticated browser acceptance still required

In this branch-scoped Preview, perform the following with *Staging-only accounts*:
- Log in as current Staging Group Admin at `/admin/property-operations-pilot`, verify controls and that there is initially no run.
- Create only a clearly marked synthetic run on a test property; activate it deliberately and assign a verified **Staging test user**.
- Sign in as that same Staging worker at `/pilot/staff`. Confirm one property only, add a fictional visit and maintenance ticket, inspect history on desktop/mobile.
- Sign in as another unassigned test client and confirm both routes and data are denied.
- Admin revokes the worker grant; user must lose visibility without needing a new login, and their form submissions must be rejected.
- Admin terminally stops the run, confirms no restart and keeps immutable audit for later approved retention.
- Reconfirm no invoice, payment, owner stay, booking, Capital or email side effects.

**This manual signed-in browser acceptance has not been completed by the assistant.** Do not assert that it has passed.

## Next Production gates (NOT completed)

1. Review Production backup/restore/PITR policy and demonstrate an actual restoration to a separate safe environment. Record recovery point and expected loss window.
2. Build and peer-review **Production-specific migration** from the Staging-tested schema. Its default state must be OFF and all new tables must remain empty after application.
3. Rehearse migration and recovery on a restored Production-like clone, including negative access tests with legacy accounts and changes to source tables explicitly forbidden.
4. Obtain separate signed-off Production schema release; keep the server pilot OFF on initial deployment.
5. Activate a named existing client account such as Catherine **only after** verifying the correct property, their role and scope, with explicit separate approval and a synthetic pilot data policy.

No part of this document is approval to apply schema to Production or import real historical expenses.
