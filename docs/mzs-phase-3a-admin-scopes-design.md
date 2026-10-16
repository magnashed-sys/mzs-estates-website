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
