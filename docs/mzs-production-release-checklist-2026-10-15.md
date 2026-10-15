# MZS Group — Production release checklist (15 October 2026)

**Status: PREPARED / DO NOT MERGE UNTIL OPERATOR PRECONDITIONS VERIFIED.**

Target: https://www.mzsgroup.eu
Production Supabase project: `ptrnjzmcehrhbsfxntgw`
Isolated Staging Supabase: `senonkpxdtlhyhrubicg` (NEVER substitute for Production).
GitHub PR: https://github.com/magnashed-sys/mzs-estates-website/pull/3
Production base commit: `39c6febce555d33ecb34e5166f4924ee82811ebb`
Working branch: `feature/account-registration-verification-notifications`

## Completed staging evidence

- New signup with 8+ character password, confirmation, inactive account and verified admin approval.
- Instant branded activation email and instant emails on added Investment/Sale/Rental/Financing rights.
- Fully new project grant successfully triggered an email in a single delivery attempt.
- Retried queued test emails successfully; total 6/6 mail outbox records sent, no pending.
- No-op permission saves and permission removals caused no new notification; rolled-back SQL tests.
- Client cannot approve or change rights; unverified/pending accounts cannot be activated outside approval.
- Case-insensitive duplicate email prevented by unique constraint.
- Password recovery with one-time consumed proof succeeded without losing any rights.
- Legacy invitation successfully completed and assigned only its selected synthetic investment right.
- No customer data was ever imported into Staging.

## Read-only production baseline (15 Oct, before release)

- `auth.users`: 11
- Active profiles: 11 (1 admin + 10 clients)
- `project_access` grants: 32
- `offering_access` grants: 40
- `access_requests`: 17
- `access_invitations`: 12
- Duplicate normalised profile-email groups: 0
- Database: ACTIVE_HEALTHY.
- Current production Vercel deployment: READY, on `main` at `39c6febce555...`

Do not expose any passwords, recovery links, SMTP credentials or service keys.

## Operator preconditions (must be confirmed BEFORE any production migration)

1. **Verify a recent restore point** in **Supabase Production** >
   Database > Backups. The Supabase Pro plan has scheduled backups; verify
   a suitable backup **actually exists** and record its time.
   https://supabase.com/docs/guides/platform/backups
2. **Supabase Production > Authentication > Providers > Email**:
   email signups and **Confirm Email ON** for newly registered users.
3. **Supabase Production > Authentication > URL Configuration**:
   Site URL `https://www.mzsgroup.eu`, allow
   `https://www.mzsgroup.eu/registration-pending`.
   Do NOT delete the working `/auth/confirm`,
   `/reset-password` and `/accept-invitation` redirects.
4. **Supabase Production > Authentication > Email Templates >
   Confirm Signup**: use the MZS black/gold template at
   `docs/mzs-confirm-signup-email-template.html` with the Supabase
   `{{ .ConfirmationURL }}` placeholder. Preserve all existing Invite
   User and Reset Password templates.
5. **Vercel > MZS Group > Environment Variables**:
   verify the **Production-only** Supabase values point to
   `https://ptrnjzmcehrhbsfxntgw.supabase.co` and that the
   server-only service role key matches Production (never disclose values).
   Verify Production SMTP (`MZS_SMTP_*` or existing `SMTP_*`)
   for the verified MZS invitations mailbox.
   Add a strong, private **CRON_SECRET** under Production so the
   scheduled retry route can authenticate.
6. Do not yet enable `MZS_ACCOUNT_REGISTRATION_ENABLED` in Production
   unless the database migration has already succeeded. No other branch
   or staging credentials may be assigned to Production.

The connector cannot list or change protected Vercel environment
variables (403); these settings require the operator's dashboard action.
The connector cannot attest that a recent Production backup is present;
the operator must verify that in Supabase.

## Coordinated release steps after preconditions

1. Re-check production baseline and GitHub PR mergeable/READY build.
2. Apply only `supabase/migrations/20261014_account_lifecycle_v2.sql`
   to **Production** through Supabase migration tooling.
   Do NOT execute any staging seed SQL or the deferred hardening migration.
3. Read-only post-migration check: legacy accounts, 17 requests,
   12 invitations and all existing grants preserved; new columns, trigger,
   new outbox and RPCs present; no unexpected Auth changes.
4. Set `MZS_ACCOUNT_REGISTRATION_ENABLED=true` **Production only** in
   Vercel after successful schema migration. Environment changes are
   picked up by subsequent deployments. Keep Preview branch overrides on
   Staging only.
5. Mark PR ready and merge to `main` to trigger the Production build.
   Verify Vercel Production deployment READY and serving the new SHA.
6. Smoke-test: landing page, existing admin/client login, private rentals,
   password recovery, new registration, confirmation email, inactive
   account, approval and instant activation mail, new project notifications,
   and retry endpoint Cron authentication.
7. Review Supabase Auth logs, Vercel runtime logs, outbox state and
   real client permission counts. User confirms website behavior.

## After stable rollout (separate change!)

Only after confirming that the new password-registration workflow is
live, consider
`supabase/migrations/20261014_account_lifecycle_v2_hardening.sql`
to block legacy anonymous direct inserts. Plan for browser tabs using
cached old forms: they may need refresh. Do not combine this with the
primary production schema deployment.

## Rollback / stop conditions

- If the migration fails, **do not merge**.
- If Production env points to Staging, **stop**; do not enable signup.
- If Confirm Email or SMTP is missing, **stop**; do not enable signup.
- If the Production build fails, leave current `main` live and fix
  the branch; never apply staging seeds to Production.
- If the new app has serious issues, first disable
  `MZS_ACCOUNT_REGISTRATION_ENABLED` and redeploy/roll back the
  application to the last working commit using Vercel/GitHub controls.
  Treat schema changes as additive; do not blindly reverse/drop tables
  or delete newly registered accounts. Escalate to restore using the
  verified backup only if materially needed.
- Preserve all production client data, project rights and prior emails.
