# Daily staff and maintenance operations

This release adds `/staff` and `/admin/workspaces/estates/staff` for real operations. Existing pilot records and pilot access remain separate. An administrator must explicitly grant each existing Client/Partner account access to each physical property; no role or account is changed by deployment.

Employees record actual visit minutes and maintenance reports, see their own outcomes and issue history, and request time corrections before or after review. Administrators approve or return visits with an explanation, decide corrections, and review each approved revision. Original records and decisions are append-only. Rejected corrections retain the previous revision; pending corrections exclude a visit from approved totals. Optional rounded minutes are a separate proposal and never create a wage, tariff, tax calculation or invoice.

Maintenance has triage, responsible person, planned date, in-progress, resolved, closed and reopened states. Only an active administrator or explicitly assigned active worker can be selected as responsible. Status updates and notes are controlled by administrators. Employees see updates on their own reports; assignment does not grant additional dossier access or send notifications.

The property overview shows open maintenance, visits awaiting assessment, approved hours and existing expense-draft amounts. Amounts are explicitly concepts, not spending or payroll. Registers use 25-row pagination and property filters. Historical details are loaded separately; failures never display partial totals as complete.

## Database rollout

1. `20261028181502_staff_maintenance_core.sql` installs the reviewed core on Production without seeds; it preserves the existing matching Staging foundation.
2. `20261028181508_staff_maintenance_daily_work.sql` adds immutable revision reviews, planning and scoped current-state views. Existing Staging reviews retain their reviewed-minute snapshot.

3. `20261028182737_staff_maintenance_stale_planning.sql` rejects outdated maintenance forms by checking the latest event under a ticket lock.

All public base tables use RLS and column-specific INSERT grants. No authenticated UPDATE/DELETE or anonymous reads are allowed. Private security-definer trigger functions enforce actor identity, scope, immutable provenance and serialized decisions. Narrow private directory/review helpers are needed to avoid exposing the full property/tenant registers or commercial review fields. Public views are security-invoker views.

## Verification

- 291 automated tests passed, including a real PGlite/PostgreSQL role-driven workflow: unassigned access, cross-property attempts, immutable originals, corrections after approval/rejection, duplicate and stale review rejection, pending-correction totals, separate rounding, planning transitions, unassigned assignee rejection and access revocation.
- Next.js production build and TypeScript passed.
- Exact migrations plus `tests/db/staff-daily-work-rollback.sql` rehearsed successfully on both Staging and Production inside transactions ending in ROLLBACK. These exercise actual authenticated policies and schema, without retaining fictional records or grants.
- Baseline fingerprints captured for profiles, booking/contract/Capital registers, expenses and pilot records before deployment.
- Browser has no signed-in MZS session. Authenticated visual end-to-end verification is not claimed; SQL role tests verify the database workflow and anonymous HTTP checks verify the route boundary.

## Rollback

Restore the previous Vercel release (PR #158, commit `09ba5efc1e2e5d9381461c424b8cbf9c17872c43`) and its matching pilot-release SHA environment variable. Keep additive staff tables and history intact; never delete operational records to roll back the UI. No billing, PDF upload, external supplier commitment, payments or notifications are part of this release.
