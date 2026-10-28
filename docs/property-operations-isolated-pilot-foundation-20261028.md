# MZS Group — Isolated Production Pilot Foundation (separate review slice)

**Status 28 October 2026:** code and review-only SQL on an independent development branch. **NOT migrated or deployed to Production.** Not activated on Staging or Production. This is a technical foundation, not a finished employee or admin UI.

## Why separate from Draft PR #143?

Draft PR #143 includes broad Staging-only Property Operations, supplier expenses, document storage, Financial Cockpit changes and accountancy rehearsal exports. **Do not merge that entire Draft to run a small live-account test.** This independent branch starts from the unchanged `main` release baseline and carries **no** finance/accounting UI or old Staging-only SQL migrations.

## Precisely scoped technical implementation

- `supabase/plans/20261028_mzs_ops_isolated_pilot_v1_review_only.sql` is deliberately under **plans**, not migrations. It has **not** been applied to either Supabase project.
- Five separate append-only pilot-only tables: run, run status journal, explicit account/property access journal, synthetic actual work visits and synthetic maintenance reports. No names, emails or account identifiers are seeded.
- **Default OFF:** a newly created run has no activation event. Activation requires a current active Group Admin; it is limited to one active run per physical property.
- **One-way STOP:** deactivation is terminal; reactivation of the same run is impossible, preventing previous grants from silently becoming valid after emergency shutdown. A new run requires a separately evidenced fresh setup.
- Every visible operational record is in a dedicated `mzs_ops_pilot_*` namespace and carries `run_id`. Pilot staff roles remain `client`/`partner`, never admin.
- RLS denies anonymous access and direct UPDATE/DELETE; append-only journals preserve authorization provenance. Workers can see only their own pilot visits and tickets while the run is active and their grant is current. Group Admin can review audit after deactivation.
- The narrow `mzs_ops_pilot_my_properties` directory provides only allowed object labels. It does not grant full physical-property, tenant, private-owner or financial data.
- Database triggers enforce real signed-in account identity and verify a visit or ticket belongs to the exact run property. There is no direct connection to `mzs_lease_*`, `mzs_booking_*`, `mzs_capital_*`, email or finance registers.

## Server-side gating — default disabled

`lib/property-operations/pilot-environment.ts` implements a pure validated environment contract. Future routes must additionally enforce user identity, current property grant and active database run:

- Preview mode is available **only** when `VERCEL_ENV=preview`, the exact **MZS Staging** Supabase URL is configured, and a dedicated server-side Staging flag is exactly `true`.
- Production mode requires `VERCEL_ENV=production`, the exact **MZS Production** Supabase URL, `MZS_OPS_PRODUCTION_PILOT_ENABLED=true` **and** a reviewed 40-character commit SHA exactly matching the deployed Vercel Git commit.
- Neither flag is set or modified by this branch. No client-side environment variable grants access.
- The database needs a separately approved activation event and an exact current grant, even if the server gate is enabled.

**The gate is not yet wired to live routes** and therefore no new employee pilot UI is reachable from this work. Do not claim the pilot is activated.

## Automated verification included

`tests/mzs-ops-isolated-pilot.test.mjs` runs PGlite role-based integration with independent synthetic accounts and properties:
- no access or visibility before activation and grant
- denied nonadmin run creation, denied inactive worker and duplicate grant
- one active run per property
- correct narrow directory; full private property records remain unavailable
- own visit/ticket allowed, wrong property and other account denied
- no direct updates/deletes
- revocation instantly removes data visibility and write permission
- run deactivation immediately removes visibility and is irreversible
- no modifications to synthetic legacy rental, invoice or capital tables

`tests/mzs-ops-pilot-environment.test.mjs` checks missing, wrong, stale and mismatched environment variables; the safe default is OFF.

These are automated code/SQL rehearsal checks, **not** signed-in mobile/browser acceptance and **not** evidence of any successful Production migration.

## Next steps before requesting any Production approval

1. Obtain green CI on the exact new Draft PR head; peer review SQL SECURITY DEFINER scope, RLS and concurrency; verify latest Supabase security guidance.
2. Adapt this reviewed plan into an additive Supabase CLI-generated migration **for isolated Staging only**, applying it there after owner-confirmed test accounts and in-memory DB acceptance. Never seed Production profiles or import Catherine's records.
3. Build a small Stage-only Group Admin and staff pilot UI using the above server gates. Explicitly validate login, existing-role identity, one assigned property and separate synthetic records. Do not copy the 100+ file accountancy feature branch.
4. Add optional visit-review/correction and maintenance lifecycle, after unit, supplier and privacy tests. Photos remain OFF until EXIF, content/malware, retention and signed download decisions.
5. Rehearse the revised **Production-specific** migration on a restored Production-like database, verify a successful recovery and compare read-only register baselines. Production backup/PITR restoration evidence is not yet available.
6. Only then request *separate* approval for Production schema (default OFF), separately for deploying the pilot UI (OFF) and separately for activation of one verified existing account and one property. Catherine's exact duties/property cannot be inferred from her profile alone.

## Emergency isolation

With the independent pilot run activated after authorization, append a **deactivate** event using active Group Admin credentials; database RLS and private helper functions immediately deny all worker visibility and inserts regardless of preexisting sessions. Revoke scope in the append-only log and turn off the server-side feature flag. Keep immutable pilot records for audit/retention. Do not drop tables or restore the entire Production database as a casual rollback: doing so could discard valid concurrent invoices or bookings. Application rollback uses the previously recorded known-good Vercel production deployment and independently verified source registers.

**Owner approval remains mandatory for every Production migration, deployment, live-account grant and pilot activation.**
