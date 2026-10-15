# MZS Group — Verified Registration & Notifications V2

STATUS: DRAFT / NOT RELEASED. Do not merge or apply the production SQL before testing.

## The new account journey

1. Request Access asks for a password of at least eight characters.
2. A server-validated Supabase signup immediately creates an inactive profile
   and a pending access request linked to the account.
3. Supabase sends the Confirm Signup email. Confirming the address sets
   email_verified_at; the member is still inactive.
4. The admin chooses client/partner role and the individual project/offering
   permissions, then approves in one database transaction. One activation
   notification is queued for the account.
5. Adding genuinely new project/offering rights later queues a separate
   notification. Re-saving unchanged rights and removing grants do not.
6. Notification delivery uses a private outbox and authenticated SMTP.
   Permission changes survive temporary email failures. Daily Vercel Cron
   retries undelivered events; immediate sends are attempted after admin actions.

## Email delivery verification — 14 October 2026

**CONFIRMED by site administrator on MZS Preview:**
- Secure SMTP connection and mailbox authentication verified by the
  protected admin Relationships dashboard.
- One real account notification **test** message sent from the preview.
- Administrator confirmed its successful arrival in the mailbox, with
  correct MZS Group black-and-gold HTML rendering.

**NOT YET TESTED:**
- Supabase Auth **Confirm Signup** mail and callback for a newly registered account.
- Real account activation email after the new SQL migration.
- Project-grant notification after the new SQL migration.
- Mail outbox retry worker (requires a configured CRON_SECRET).

**Safety:** The test email did not create or modify accounts, approvals,
project assignments or bookings. The feature branch and database migration
are still not released. The new registration endpoint is fail-closed unless
MZS_ACCOUNT_REGISTRATION_ENABLED is explicitly set to true after testing.

## Required Supabase configuration

- Authentication / Sign In / Providers / Email: confirm email is ENABLED.
- Password minimum remains 8 characters.
- Authentication / URL Configuration Site URL: https://www.mzsgroup.eu
- Add Redirect URL: https://www.mzsgroup.eu/registration-pending
- Authentication / Email Templates / Confirm Signup: paste the matching HTML
  file from docs/mzs-confirm-signup-email-template.html.
  Its button uses the standard Supabase ConfirmationURL placeholder.
- Do not change the working password recovery template or invitation callback.

## Required Vercel environment variables

The following values must be configured securely via Vercel Settings,
not provided in chat or committed to GitHub.

- NEXT_PUBLIC_SUPABASE_URL (already used by production)
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (already used by production)
- SUPABASE_SERVICE_ROLE_KEY (existing server-only secret)
- MZS_SMTP_HOST (business mail server hostname)
- MZS_SMTP_PORT (465 implicit TLS or 587 STARTTLS)
- MZS_SMTP_USER (mailbox login)
- MZS_SMTP_PASSWORD (mailbox secret)
- MZS_SMTP_FROM (verified sender name and address)
- CRON_SECRET (long random secret for the scheduled delivery endpoint)

## Reusing the existing invitations mailbox

The mail sender can reuse existing `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` variables if Vercel
already contains them. New `MZS_SMTP_*` settings are optional overrides.
If the existing SMTP username is a full mailbox address and no explicit
sender is configured, the mailer uses `MZS Group <mailbox>`.

**Supabase Auth SMTP settings are not automatically shared with Vercel.**
If the invitations mailbox credentials exist only under Supabase
Authentication → SMTP Settings, copy them securely into
Vercel → MZS Group → Settings → Environment Variables, without
pasting credentials into chats, issues or GitHub.

After any Vercel environment variable update, trigger a new preview
deployment. An authenticated administrator can then visit
Admin → Relationships → **Verify SMTP connection** to run a
server-side handshake test. No SMTP credentials or hostnames are
returned to the browser. This verifies connectivity and login only;
a real delivery test remains mandatory before publishing.

The Vercel environment-variable connector currently returns access denied, so
those settings have NOT been read or edited. The SMTP provider must also be
authorised for the sender domain (SPF, DKIM, DMARC).

## 15 October 2026 — staging end-to-end test status

**Verified in the isolated MZS Staging project:**
- A new user registered with a password, received and clicked the Supabase
  confirmation email, and remained inactive pending approval.
- Admin approval activated the account and assigned exactly the selected
  Investment offering. The activation email was initially queued, then
  delivered on the first explicit retry. The approval flow was subsequently
  changed to dispatch server-side in the same authorised request.
- The test member subsequently gained Financing and Rental rights. Two
  pending notification emails were delivered through the staging retry
  action and recorded as `sent`, with one attempt each.
- A later **new offering** assignment (Private Sale under the existing
  TEST — Development Opportunity project) generated one new notification
  and was sent **immediately**, with exactly one recorded delivery attempt.
- In total, one application email, one activation email and three
  new-access messages were recorded as sent. No pending messages remained.
- The separate TEST — New Investment Opportunity project has **not yet**
  been granted to the test client. Adding a separate new project is still
  an optional final scenario.
- All actual production deployments remained on the main branch.

**Before production release:**
- Review the pending GitHub draft PR and migration, test recovery/invite
  compatibility, role and permission changes, and no-op updates.
- Validate strict sender delivery and notification retries with production
  SMTP settings and the configured scheduler.
- Coordinate the schema migration and app release. Do not merge the draft
  PR without operator approval.

## 15 October — additional negative-path checks

Checked in MZS Staging only, using database transactions explicitly
rolled back after each verification:
- Rewriting the exact same access selection did NOT enqueue another mail.
- Revoking an existing test offering did NOT enqueue a new-access mail.
- The recorded outbox count remained 6 before and after both checks.
- After rollback, the five assigned test offerings remained in place.
- This establishes the database grant-diff behaviour; full end-to-end
  browser checks for recovery, old invitations and failed SMTP delivery
  remain required before releasing to production.

## Release audit — additional checks, 15 October 2026

Completed in **MZS Staging**, with no production mutations:
- Verified all six logged transactional emails were marked sent; zero unsent.
- Verified there are no duplicate email groups in the staging profile table.
- Verified all public application tables are protected with RLS.
- Verified no unconfirmed Auth users have assigned project grants.
- Verified new privileged account functions deny the anon role: approval,
  changing project rights, outbox claims, rate limiting and signup trigger.
- Repeated selection and revoked selection were exercised inside rolled-back
  transactions: no new access email was queued. Existing five offering grants
  remained intact after rollback.
- Inspected, but did not re-run, the existing login, recovery, invitation
  and confirmation routes. Static inspection is NOT a replacement for browser
  tests with real email links.

Security audit findings to assess before release:
- Existing `public.is_admin()` is executable by anon according to
  Supabase security advisor. It only returns a boolean, but its public
  execution privilege should be reviewed with RLS regression tests.
- Supabase leaked password protection is not enabled in both checked
  projects. Consider enabling it after compatibility review.
  See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- `btree_gist` is in the public schema, an existing warning:
  https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- Tables holding private auth proofs, rate limits and mail outbox intentionally
  have RLS enabled with no public policies. This is not missing user access;
  server-only functions own these operations.

Not yet verified end to end: duplicate-email race, invalid signup passwords,
unverified user approval denial, old-invitation flow, admin/client/partner
password recovery and an intentionally failed SMTP delivery then retry.
Do not publish until these checks and an operator-approved rollback plan
have been completed.

## Safe release order

1. Review draft pull request and test it in a separate Supabase test project.
2. Back up the production database.
3. Configure Supabase Confirm Signup and Vercel SMTP settings.
4. Apply the reviewed SQL migration.
5. Merge the GitHub pull request once tests pass.
6. Test one fresh registration and full approval cycle in production.
7. Only then apply the optional RLS hardening migration that prevents legacy
   direct access_requests inserts from anonymous public clients.

Until the new website code is live, the previous request form keeps working,
and any requests created during the short transition remain legacy requests.

## Essential acceptance tests

- New applicant enters matching eight-character passwords; account and pending
  request are linked. Email confirmation arrives.
- Email confirmation makes the address verified but leaves account inactive.
- Existing-email duplicate, invalid email, and rapid repeat submissions fail.
- Admin cannot approve unverified users or assign inactive offerings.
- Admin approval atomically activates the user, stores BOTH project and
  offering grants, and queues one activation email.
- User login sees only the explicitly assigned opportunities.
- Adding new grants triggers one notification; re-saving unchanged grants
  does not. Removing grants does not send a new-access notification.
- With SMTP deliberately unavailable, access still saves and email stays
  queued for retry. Test a later successful retry and actual delivery.
- Old invitations, existing accounts, forgot password, rentals, investments,
  account deactivation and the admin dashboard continue working.

## Security notes

- No SMTP passwords or Supabase service role keys are exposed in the browser.
- Email confirmation never grants access by itself.
- Server-side project permissions remain mandatory regardless of frontend UI.
- Email sending is at-least-once delivery, not exactly once; a provider may
  accept a message immediately before the database fails to mark it as sent.
- Vercel Hobby limits Cron to one scheduled run per day. Immediate sends are
  attempted when an account is registered or access is approved or expanded.
  Faster background retries require an eligible Vercel plan or external scheduler.
- The migration changes authentication-related database functions; do not apply
  it without staging tests and a rollback plan.
- Images currently kept in public/properties are NOT made private by this work.

This release has not yet been activated on the production website.
