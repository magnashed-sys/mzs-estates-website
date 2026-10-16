# MZS Group — Phase 3A.1: Administrative Scopes (Design Gate)

**Status:** Design only · isolated feature branch · **NO Production change**.

## Confirmed structure
- MZS Group: overarching administration, Group Administrator.
- MZS Estates: property, rental, sales and development administration.
- MZS Capital: real-estate and non-real-estate private investment, equity, debt, corporate finance and external opportunities.
- Shared Relationship 360, with access scoped per business unit.
- Clients/partners retain explicit project and offering grants.

## Inventory (Supabase Staging, 16 October 2026)
- `profiles.role` is an existing enum used by legacy code. `public.is_admin()` currently checks **active profile + role = admin**.
- Existing `projects`, `offerings`, `project_access`, `offering_access`, `profiles` and company RLS policies use `is_admin()` for broad admin access.
- Both the current Project Cockpit and central Admin page directly require active `profiles.role=admin`.
- Consequently, **do not** assign department operators `profiles.role='admin'`: that would grant cross-department legacy access.
- Similarly, do not rewrite `is_admin()` globally or change legacy project permissions as part of the first phase.

## Safe staged architecture
1. New independent `mzs_admin_scope_assignments` table with user UUID, department (`estates`|`capital`), scope role, activation state, assigned-by and audit metadata. Group Admin mapping stays explicit and restricted to an existing active administrator.
2. New department-specific data/tables and RLS use a scoped verifier (never `is_admin()` alone). Anonymous and unassigned accounts get no access.
3. Legacy real-estate tables remain managed through the existing Group Admin routes during initial phase. Allowing Estates Admin to edit those tables requires a **separate, audited migration of every relevant policy and server-side RPC**; do not broaden grants as a shortcut.
4. Capital opportunities use their own model, can optionally link to an Estates project, and are private by default. Client visibility is explicit and independent from project_access.
5. People and companies are shared entities, but department visibility/notes and permissions are filtered by dedicated relationship-scope mappings. Never assume that shared contact access implies financial access.
6. Initial UI uses isolated department dashboards and clear permission-denied states. No existing /admin route should start trusting new scope assignments until its data queries have been scoped.
7. Group admin provisioning must not depend on a hard-coded email. Require an existing active admin and a controlled, audited assignment process.
8. Keep all new controls and migrations off Production pending separate owner approval.

## Acceptance gates
- Role tests: Group Admin both units; Estates Admin Estates only; Capital Admin Capital only; client/partner neither.
- Cross-scope direct REST requests and signed document access fail closed.
- Existing auth, requests, Relationship 360, rental calendars, booking/cancellation, documents and project grants unchanged.
- RLS tests with seeded synthetic Staging users and rolled-back fixtures.
- Verify no user metadata is used for authorization, prevent self-escalation, record assignments and revocations, test deactivated admins.
- Verify staging isolation, successful Vercel Preview build, then owner acceptance and explicit Production approval.

## Release caution
The first implementation should **not** overwrite `profiles.role`, `public.is_admin()`, legacy RLS policies, or change any live permissions. Propose migration only once role assignments and dependent UI/API surfaces are reviewed.

## Integration review — Private Capital Requests (17 October 2026)
- Current `main` includes Production commit `2d28ee6b` (Capital Requests) and `2d73f338` (Private Capital layout). Preserve both.
- `mzs_capital_requests` is already deployed in both Staging and Production; **do not recreate or migrate it** as part of Phase 3A.
- The existing Capital Requests admin UI and PATCH API currently require active `profiles.role='admin'`, and the read RLS permits the request owner or an active legacy admin. Department scope is **not yet integrated**.
- The phase-3 scope assignment table exists only in Staging, currently with 0 scope assignments and 2 RLS policies.
- A Capital Administrator must never be granted the legacy `admin` role just to access Capital Requests. Implement dedicated scoped admin read and update paths after verifying all surrounding RLS, service-role API enforcement and audit behavior.
- The `mzs_has_department_scope` helper validates active profile and assignment, but future group/department role semantics and provisioning constraints need additional review before assigning personnel.
- The Phase-3 branch is behind `main` by 2 Capital commits as of this review. Sync using a reviewed forward-only merge/rebase, preserving both branches and avoiding force pushes; verify new Vercel Preview on the updated head.
- No changes to Production or to the existing Capital Requests workflow are authorized by this note.

### Acceptance tests required for Capital integration
1. Assigned Capital Admin can access only the scoped Capital administration routes/data.
2. Estates Admin cannot read or change any Capital request, including direct REST/API requests.
3. Regular client can only see their own eligible requests and cannot perform admin updates.
4. Group Admin retains existing authorized visibility and can audit scoped admin actions.
5. Revoked/deactivated assignments stop authorizing immediately; rejected changes do not create side effects.
6. Existing Production Capital Requests UI and delivery workflow remain intact.
