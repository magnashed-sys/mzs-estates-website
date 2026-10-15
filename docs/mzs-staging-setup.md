# MZS Staging — isolated Supabase test environment

Status (15 October 2026): Isolated Supabase Staging + Preview verified; registration, approval, new-access emails and security guards tested. Production remains untouched.

## Provisioned on 14 October 2026

- Supabase organization: MZS (Free plan)
- Cost confirmed through Supabase: EUR 0 per month
- Staging project: MZS Staging
- Staging project ref: senonkpxdtlhyhrubicg
- Staging API URL: https://senonkpxdtlhyhrubicg.supabase.co
- Database region: eu-west-1 (same European region as production)
- Production project: ptrnjzmcehrhbsfxntgw — never modify for staging tests.

## Isolated database setup

Replayed schema-only migration history from MZS production into the NEW
staging database, excluding the two historical project/email-specific seeds:
- seed_floraweg_investment_test_access
- add_floraweg_sale_test_offering

Removed the property-specific data insertion from the historical
marina_botafoch_secure_rental_configurations migration.

Then applied **20261014_account_lifecycle_v2.sql** to STAGING ONLY and
the synthetic staging seed in supabase/staging/seed_synthetic_projects.sql.

Verified:
- 22 public tables, all with RLS enabled.
- Account creation and email confirmation triggers installed.
- 3 synthetic TEST projects and 4 synthetic TEST offerings.
- 0 auth users, profiles, access requests, grants, and email messages.
- No production accounts, passwords, or customer data were imported.

## Required Vercel environment variable overrides

Project: MZS Group
Git branch: feature/account-registration-verification-notifications

In Vercel > MZS Group > Settings > Environment Variables, create
BRANCH-SPECIFIC PREVIEW overrides for these exact variable names:

| Name | Source | Target |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | https://senonkpxdtlhyhrubicg.supabase.co | Preview, branch ONLY |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase Staging > Settings > API Keys > default publishable key | Preview, branch ONLY |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Staging > Settings > API Keys > service_role secret (server-only) | Preview, branch ONLY |

This overrides the general Preview values and prevents staging registration
from connecting to the production database. DO NOT edit the Production
values, the main branch, or other unrelated Preview environments.

Additional environment flag, branch-specific Preview ONLY:
- MZS_ACCOUNT_REGISTRATION_ENABLED = true

**Do not enable this flag until all three Supabase variables are correctly
overridden, Confirm Email is enabled in STAGING, and a safe test mailbox
has been configured.** The registration API also denies any Preview
signup when its Supabase URL is not exactly the known MZS Staging URL.

Environment-variable edits only apply to NEW Vercel deployments.
Start a new Preview build by committing a change to the feature branch.

The Vercel management connector returned 403 for environment variable
operations, so the owner must enter sensitive values in the dashboard.
NEVER share secret values in chat, screenshots, code or GitHub.

## Required Supabase Staging Auth configuration

In the separate MZS Staging project:
1. Authentication > Sign In / Providers > Email: email/password and
   Confirm Email must be enabled.
2. Authentication > URL Configuration: set the staging Preview deployment
   URL as Site URL; add that exact URL plus /registration-pending to
   allowed redirect URLs. Update this when the Preview URL changes.
3. Authentication > Emails > SMTP Settings: configure the existing
   MZS invitations mailbox if confirmation emails must reach external
   test addresses. Staging is a separate project and does not inherit
   the production Auth SMTP configuration.
4. Authentication > Emails > Templates > Confirm Signup:
   use docs/mzs-confirm-signup-email-template.html. Do not change production
   email templates during staging preparation.

## Preview signup readiness and confirmation URL

The administrator's separate staging login was verified on 15 October 2026.
A safe registration flag is still required before any new test applicant
can register.

- Supabase Staging Authentication > URL Configuration:
  add the branch-specific, project-scoped wildcard Redirect URL
  `https://mzs-group-*-mzs3.vercel.app/registration-pending`.
  Keep the existing Site URL and exact redirect URL intact. This extra
  allowlist entry is necessary because each GitHub Preview deployment
  gets a different immutable hostname.
- Vercel Environment Variables:
  add `MZS_ACCOUNT_REGISTRATION_ENABLED=true`, selecting ONLY Preview
  branch `feature/account-registration-verification-notifications`.
  **Never set this flag for Production at this stage.**
- Redeploy by committing to the feature branch, since Vercel environment
  variable changes only apply to new builds.
- Verify `/api/staging/readiness` on the NEW Preview has
  `isolatedStagingDatabase=true`, all key probes true, and
  `registrationEnabled=true` before entering any test account details.
- Submit a fresh applicant using an email inbox under your control and
  a new strong password. Use a private/incognito browser window for
  the applicant to avoid overwriting the test admin's existing session.
- A confirmation email is sent by **Supabase Staging Auth**; do not
  confuse this with the already validated MZS SMTP notification test
  from the Next.js app.
- This staging registration does not create or change Production users.

## First staging administrator

Production accounts have NOT been copied. Before testing approval:
- Manually create a staging-only admin Auth account through
  MZS Staging > Authentication > Users. Set a fresh password privately.
- After the Auth user exists, promote only this staging user's profile
  to admin and active using a reviewed SQL command targeted to staging.
- Use another freshly created test email account for the end-to-end
  client registration/verification/approval/notification test.

## Final pre-production checks — 15 October 2026

The staging and production projects are separate. Production is on `main`,
and the feature PR remains a draft. Password minimum is **8 characters**.

Completed without any lasting changes to the staging client:
- Saving identical rights emits **zero** extra emails.
- A rights removal correctly removes project+offering grants and emits
  **zero** new-access emails; the transaction was rolled back.
- A non-admin client cannot approve a registration or edit another
  user's rights.
- Unverified email registration cannot be approved (rolled-back test).
- A pending registered application cannot be activated by bypassing
  the verified approval RPC.
- Case-insensitive duplicate profile email is rejected by the unique
  database constraint (rolled-back test).
- The live/legacy invitation and password-recovery RPC definitions remain
  identical across Production and Staging.
- Five client test offering rights and the six sent notification records
  remained intact; no pending mail was left.

### Staging-only password recovery (still requires interactive test)

The Preview forgot-password form now gives Supabase a redirect at
`https://<preview-host>/auth/confirm` (Production's existing
`/reset-password` redirect is left alone).

To test securely, in **Supabase Staging only**:
1. Authentication > URL Configuration > Redirect URLs: add
   `https://mzs-group-*-mzs3.vercel.app/auth/confirm`. Keep existing
   `/registration-pending` redirect and Site URL unchanged.
2. Authentication > Email Templates > **Reset Password**: paste the HTML
   from `docs/mzs-staging-reset-password-email-template.html`.
   It uses `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`
   and returns the user to Preview via the one-time verified callback.
3. On the newest READY Preview, open `/forgot-password` as a test client;
   request recovery and follow the email link privately. Confirm that the
   page allows an **8-character minimum** and sends the user back to the
   staging login; do not share tokens, links, or passwords.
4. Test a fresh email that already has a staging account via
   `/request-access`: the form should reject duplication immediately
   (HTTP 409); do not share the password. Confirm no extra auth user
   or mail queue record was created.

Do not alter or replace the existing Production password-recovery or
invitation templates during this staging verification.

## Legacy invitation Staging deployment — 15 October 2026

Verified the manually installed Edge Function was initially still the Supabase
starter example. Replaced it via the authenticated Supabase Staging connector
with the validated MZS staging-only function. Current version: **2**, ACTIVE,
JWT verification enabled. The implementation checks the fixed MZS Staging
Supabase URL, accepts only `mzs-group-*-mzs3.vercel.app` browser origins,
requires an active admin, and redirects invitees to the current Preview
`/auth/confirm` callback. No production function or data was changed.

The same reviewed Deno source is preserved as
`supabase/functions/invite-approved-relationship-staging/index.txt`,
not `.ts`, to keep Deno-only imports out of the Next.js build. The updated
feature Preview has a READY deployment.

**Before an end-to-end legacy invitation test:**
- In Supabase **Staging only**, Authentication > Email Templates >
  Invite User, change the invitation CTA URL to
  `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite`
  (HTML source uses `&amp;type=invite`).
- Keep the staging Redirect URLs wildcard
  `https://mzs-group-*-mzs3.vercel.app/auth/confirm`.
- Choose a new, accessible test inbox that is not in either Staging Auth
  or Profiles. Add a *legacy* access_request with no auth_user_id in
  **Staging only**. Approve and send via Admin > Relationships, then follow
  invitation link, choose an 8+ character password and verify project rights.
- Do not use a real client email or production accounts.

## Test workflow

1. Confirm Vercel branch-specific Supabase keys point to staging, not prod.
2. Confirm staged Preview login queries staging only.
3. Enable the guarded Preview-only registration flag.
4. Submit a brand-new test account and validate email confirmation.
5. Validate account stays inactive pending admin approval.
6. As staging admin approve and grant one or more TEST offerings.
7. Confirm activation mail and private access only to granted offerings.
8. Add another TEST offering; check one new-access email, then verify
   re-saving unchanged access sends none.
9. Verify existing Production site remains unchanged and accessible.

## 15 October 2026 — preview-only signup activation check

The operator confirmed these two staging-specific settings have been saved:
- Supabase Staging Auth allowed confirmation redirect wildcard.
- Vercel Preview branch variable `MZS_ACCOUNT_REGISTRATION_ENABLED=true`.

This documentation-only commit triggers a **new Vercel Preview build**
so the updated environment variables are loaded. Confirm the
`/api/staging/readiness` response reports:
`isolatedStagingDatabase=true`, `publicKeyAccepted=true`,
`serviceKeyAccepted=true`, `testProjectsAvailable=true`,
`registrationEnabled=true` and `readyForIsolatedTesting=true`
before registering a test account. Do not set the flag in Production.

STOP if a step unexpectedly references the production Supabase project.
The main GitHub branch and production Vercel deployment must not be
changed during staging testing.
