# MZS Group — My Profile & Business Relationships (V1)

**STATUS: Draft, fully isolated in a feature branch and MZS Staging. Not deployed to Production.**

Goal: allow logged-in, **active clients and partners** to maintain their
personal contact / postal address information, request an email change,
change passwords, and independently declare multiple companies with their
relationship to each company.

## Member-facing experience

A **My Profile** link in the private collection opens `/private/profile`.
The page follows MZS Group's black/gold identity and offers 3 sections:

1. **Personal Details**: name, phone, street, house number, additional
   address, postal code, city, region and country. Name is stored in the
   existing `profiles.full_name` to keep the dashboard and admin name
   consistent. Address values are optional.
2. **My Companies**: create/edit/remove multiple privately declared
   companies. Each records legal name, trading name, registration number,
   registration country, relationship type and optional notes. Supported
   roles: owner, co-owner, shareholder, director, employee, authorised
   representative, advisor, other.
3. **Email & Security**: request an email change through Supabase Auth,
   preserving the existing email until confirmation; change password
   after checking the **current password**, with a **minimum of 8
   characters**, exactly as agreed.

Company entries are **self-declared** and do not certify real ownership,
grant project permissions, create employee accounts or imply that other
users belong to the same legal company. An administrator may read
company/address details under RLS but there is no verification workflow
or sharing between clients in V1.

## Data model

SQL migration: `supabase/migrations/20261015_member_profile_companies_v1.sql`.

- `public.mzs_member_contact_details`: 1:1 with `auth.users`.
- `public.mzs_member_companies`: 1:many with `auth.users`.
- `public.mzs_set_member_contact`: security-definer RPC. Checks
  `auth.uid()`, active client/partner status and all field lengths, and
  updates only the current member's name/contact details.
- `public.mzs_sync_verified_auth_email`: `auth.users` email-change
  trigger keeps the canonical `profiles.email` in sync after Supabase
  Auth updates the email (the browser cannot edit that column).
- RLS: inactive users cannot view or edit contact/company records;
  active users can manage only their own companies; administrators
  may read these records. No anonymous grants.

**Do not add these relationships to project-access decisions automatically.**

## Completed non-destructive tests in MZS Staging

- Migration installed, 2 new tables, RPC and email-sync trigger.
- Contact/name edit succeeded when impersonating an active test client,
  then the transaction was rolled back.
- Company insertion/update/deletion succeeded for the owning test client
  inside rolled-back test transactions.
- A different client could not see or edit the owner's company.
- An inactive client could neither edit contact info nor insert companies.
- Updating `auth.users.email` during a rolled-back Staging test updated
  `profiles.email` and normalised email while preserving offering grants.
- After tests: no new address/company records remained; pre-existing
  Staging Auth accounts/project/offering grants unchanged.
- GitHub/Vercel Preview builds compile independently of Production.

### Additional security checks

- Active users cannot insert a company row on behalf of another user.
- Inactive users cannot SELECT their prior address details, even if a
  row exists; contact-read RLS includes the active-member guard.
- Cross-client company UPDATEs affect no rows.
- Service role retains read access; anonymous access is not granted.
- Supabase Security Advisor confirms RLS is enabled on both new tables.
- The security-definer contact-update RPC is intentionally executable
  by authenticated users because it explicitly validates `auth.uid()`,
  active role and field lengths. Direct authenticated table UPDATE is
  **not** granted for personal address records.

## IMPORTANT: new Preview branch isolation

The previous account-registration staging variables were configured only
for the earlier GitHub feature branch. **This is a different branch:**

`feature/member-profiles-company-relationships`

Before using the Preview, go to **Vercel > MZS Group > Settings >
Environment Variables** and add/verify branch-specific **Preview-only**
overrides for:

- `NEXT_PUBLIC_SUPABASE_URL` =
  `https://senonkpxdtlhyhrubicg.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the **Staging** key
- `SUPABASE_SERVICE_ROLE_KEY` = the **Staging** service role key, server-only

Use the same Staging values previously used for the isolated registration
branch. Never post keys in chat. Do not change Production values.

The profile page contains a browser-side fail-closed guard against
using a Vercel Preview hostname that is not pointed to MZS Staging.
After changing Vercel environment variables a NEW Preview build must
be created to load them.

For email changes, Supabase **Staging** Auth URL Configuration must allow:

`https://mzs-group-*-mzs3.vercel.app/private/profile`

and **Secure email change** should be enabled in Auth. A message can
require approval from both old and new email addresses depending on Auth
settings.

### Interactive test checklist (Staging only)

1. Login as existing active test client or partner in the new Preview.
2. Open **My Profile**, save name and (synthetic) contact/address details.
   Verify name updates in the private dashboard and refresh preserves data.
3. Add two **fictitious** companies with different roles, then edit and
   remove one of them. Verify companies persist after reload.
4. Login as a *different* test client and verify the companies are not
   visible/editable.
5. Verify an inactive member cannot access the page.
6. Request an email change to a NEW test mailbox, follow verification
   email(s), confirm the canonical email updated and all project grants
   are intact. Do not expose email confirmation tokens in the chat.
7. Verify changing a password requires the current one and uses a
   minimum of 8 characters; sign out and back in, confirm projects intact.
8. Run Supabase Security Advisor and verify Vercel Preview READY.
9. **Only then** plan the Production schema migration + website release.

### Production release gate

- Verify Production backup, existing 12+ user accounts and all grants.
- Apply ONLY this add-on migration to Production, never Staging seeds.
- Allow `https://www.mzsgroup.eu/private/profile` in Production Auth
  redirect URLs; verify secure email change settings.
- Deploy reviewed branch to main following explicit owner approval.
- Post-release smoke test: client login, profile edit, company CRUD,
  email/password workflows, admin, existing rental/investment pages.
- New members' self-declared company entries are private and must not
  trigger project-access changes.

This feature is additive; no live account, project, booking, invitation
or notification is altered during its staging preparation.

## Preview configuration confirmation

On 15 October 2026 the site owner confirmed that all three Supabase Staging variables have been added or checked for this feature branch in Vercel Preview. A new Preview deployment is required to load them. Before interactive testing, verify /api/staging/readiness reports isolatedStagingDatabase, publicKeyAccepted, serviceKeyAccepted, testProjectsAvailable, and readyForIsolatedTesting as true. No Production variables were requested to change.
