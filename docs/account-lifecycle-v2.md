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

The Vercel environment-variable connector currently returns access denied, so
those settings have NOT been read or edited. The SMTP provider must also be
authorised for the sender domain (SPF, DKIM, DMARC).

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
