# MZS Group — Admin CRM Foundation, Phase 1

Status: **Draft / Staging Preview only; not approved for Production.**

## Product principle

Private. Independent. International.

One confidential administrator workspace should connect people, their
self-declared companies, existing opportunities and precisely assigned
project access. The portal is invitation-only. Company membership and
declared investment interests must **never** auto-grant access.

## What Phase 1 builds

1. **Relationship 360° dossier** at `/admin/relationships/[id]`
   - Explicit active-administrator guard and Supabase RLS-protected reads.
   - Member identity, role and active/inactive account status.
   - Contact and postal/NAW information from the existing member profile data.
   - All companies self-declared by that member, including their declared role.
   - Project entitlements split by project and **specific offering**.
   - A direct shortcut to the existing project-access permission editor.
   - Linked account applications, when they have an authenticated user ID.
   - Recorded milestones (account created, company declared, project-access
     grant created). These are not invented login/page-view tracking events.
2. **Relationships overview improvements** on existing `/admin`
   - Search name/email, declared company names, registration numbers,
     relationship types, telephone, town or country.
   - Contact/location summary and declared companies next to each member.
   - One-click view of relationship dossier; all existing activation and
     project-access actions preserved.
3. **Companies directory** on existing `/admin`
   - Lists member declarations independently, without falsely asserting
     distinct legal entities have been verified.
   - Search company / country / registration details / related member.
   - Deep-link to the related member dossier.
4. **Bidirectional CRM/project link**
   - Existing `/admin/project-access` links back to the selected member's
     dossier. The current permission save, validation, notification and
     confirmation logic remains intact.

## Explicitly out of scope for this first release

- Editing personal contact details on behalf of a member: they retain self-service
  control through `/private/profile`.
- Editing, creating, archiving, or publishing projects: Project Cockpit Phase 2.
- Managing offers, financial deal flow, documents or dynamic photo content:
  Phase 2/3; existing hard-coded presentations are left unchanged.
- Company master-data matching/verification or granting project rights based on
  a person's claimed affiliation. A self-declared company is **not** verified.
- CRM notes/tasks, marketing engagement tracking, login event tracking and
  automatic notifications: future phases with separate data/protection design.
- Changing existing account approval, login, booking, invitation and project
  access workflows.

## Data and trust boundaries

All existing tables: `profiles`, `mzs_member_contact_details`,
`mzs_member_companies`, `projects`, `offerings`, `project_access`,
`offering_access`, and `access_requests`.

The dashboard uses only authenticated user-scoped Supabase reads with RLS.
Both the admin overview and the dossier check `profiles.role === 'admin'`
and `profiles.is_active === true`. Supabase has existing admin-only read
policies for contact details, companies, all project/offering permissions,
and access requests.

- No service-role key is present in browser code.
- No changes to Supabase policies or schema in this phase.
- No mutation methods are added to the CRM screens.
- Company declarations are labeled self-reported.
- The dossier does not expose the admin's own account as a client/partner.
- The dossier prevents accidental connection to Production from our
  dedicated Vercel Preview branch: previews must target isolated Staging.
- No analytics claims about visits or logins; `login_history` is currently
  empty and no page-view audit trail exists in the current database.

## Test plan — isolated MZS Staging only

1. Open the new Preview URL's `/api/staging/readiness` and confirm
   `isolatedStagingDatabase`, `publicKeyAccepted`,
   `serviceKeyAccepted`, `testProjectsAvailable`, and
   `readyForIsolatedTesting` all equal `true`.
2. Sign in as the **Staging administrator**, open `/admin` and confirm
   Overview, Relationships, Companies, Projects, Bookings and Analytics
   render without errors.
3. In Relationships → Accounts, search by name and the test company's name.
   Confirm only the correct test member appears; no unrelated records.
4. Open that member's Relationship dossier. Verify its synthetic NAW,
   TEST Holdings SL / Owner (if still present in Staging), and assigned
   four synthetic projects with five offering rights.
5. Use Manage access on one existing project; confirm the saved offering
   selections and the new backlink to Relationship dossier. **Do not**
   change any rights as part of a read-only smoke test.
6. Open the Companies directory and locate the synthetic test company;
   use the dossier link, then return to Admin.
7. Sign in as a regular Staging client; verify neither dossier nor admin
   pages expose other members' personal data.
8. Verify all existing Staging grants and profiles retain identical counts,
   and Production's code and database are unchanged.
9. When changes are ready for live: require the owner's **explicit**
   publication approval, verify a recent Production backup and existing
   permissions, merge the isolated feature PR, wait for Production READY,
   and perform a live smoke test.

## Phase 2: Project Cockpit design

New `/admin/projects/[id]` should provide a single project-centric
overview with offerings, assigned members, updated materials, document
access and publication status. A safe editorial layer should separate
Draft -> Review -> Published and preserve current private RLS grants.

Data to be designed, **not yet implemented**:
- Draft/published content blocks and media ordering, with previews and
  protected Supabase Storage, plus an audit log and rollback.
- Per-offering sale/investment/rental/financing disclosures and individual
  project access review. No automatic entitlement inheritance.
- Project collaborators and client interest tracking; owner authorization
  on every API action.
- Optional project questionnaires and interest forms, mapped to existing
  questionnaire tables after permissions are reviewed.

## Phase 3: Opportunity / relationship actions

Introduce notes, tasks, consent-aware activity and opportunity stages:
interested, contacted, evaluating, negotiating, committed, completed.
Private CRM notes must be admin-only; task deadlines and histories must
have clear provenance and retention policies. Avoid depicting inferred
engagement as a confirmed event.

## Staging infrastructure

GitHub feature branch: `feature/member-profiles-company-relationships`
(reused exclusively because the Vercel Preview branch-specific Supabase
Staging secrets are already safely configured for this branch).

Supabase Staging project ref: `senonkpxdtlhyhrubicg`.
Supabase Production project ref: `ptrnjzmcehrhbsfxntgw`.

No database migration or Production deployment is authorized in this phase.
