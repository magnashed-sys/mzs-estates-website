# MZS Group — Phase 3A.5 isolated Staging acceptance

**Status:** Prepared, but **not yet signed off**. Do not merge PR #10 or deploy
the Phase 3A migrations to Production.

## Hard boundaries

- Target only Supabase **MZS Staging** (`senonkpxdtlhyhrubicg`).
- Preview must be `VERCEL_ENV=preview` and use the exact Staging URL.
- Never use an existing member, business partner, or real customer account as a
  security fixture. All user names, emails and Capital Requests must be fake.
- Keep the Staging service credential and synthetic user passwords in a local
  secret manager. Do not commit, print, email, paste into chat, or place them in
  GitHub Actions / Vercel Preview variables.
- Group Administrators retain the existing global role. Capital operators
  remain `profiles.role='client'` and get only an audited Capital assignment.
- A successful Vercel build or a SQL impersonation test is **not** an end-to-end
  account acceptance test.

## Provision isolated sign-in identities (operator action)

Use the supported Auth Admin API, *not* direct inserts into `auth.users`.
`scripts/phase3a-provision-staging-test-account.mjs` refuses any URL other
than the exact Staging project, creates a unique
`phase3a-test-<uuid>@example.invalid` identity, sets
`app_metadata.mzs_phase3a_test=true`, and activates only its newly created
client profile. **It does not grant Capital rights.**

In a secure local shell with dependencies installed and the Staging-only
values already supplied via a password/secret manager:

```sh
# Provide SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
# PHASE3A_TEST_PASSWORD from a secure local secrets provider.
PHASE3A_TEST_LABEL=Capital node scripts/phase3a-provision-staging-test-account.mjs
PHASE3A_TEST_LABEL=Estates node scripts/phase3a-provision-staging-test-account.mjs
PHASE3A_TEST_LABEL=Client node scripts/phase3a-provision-staging-test-account.mjs
```

Use different strong test passwords where practical, and save generated fake
test emails and user IDs securely. These identities have non-deliverable email
addresses and do **not** use the signup/invitation email flow. Their email
verification is only a controlled synthetic test fixture.

The script is a preparation utility. It has **not** been run as part of this
review because account creation requires secret Staging Auth credentials.

## Manual account/session acceptance gate

1. Sign in with an existing authorised **Staging Group Administrator** at
   the feature Preview; open `/admin/group/capital-access`. Confirm only
   marked test users appear.
2. Give only the synthetic **Capital** identity Capital access. Verify the
   transaction appears in the Group scope audit.
3. Sign in as the Capital test identity in another private browser session.
   It should reach `/admin/group/capital` and may open
   `/admin/capital-requests` without being a legacy Group Administrator.
4. A separate Estates-labelled account **without Capital scope** must not
   access the Capital cockpit or list requests. The same applies to the
   ordinary client. Check direct PostgREST RPC calls and the
   `/api/capital-requests/admin` PATCH route (HTTP 403 when authenticated
   without permission; 401 without authentication for a valid request).
5. Use one **synthetic** Capital Request (created in Staging only and without
   production mail side effects). Confirm that a Capital operator can read
   and change its status and cannot directly update the underlying table.
   Check the exact actor, previous/new status and timestamp in
   `mzs_capital_request_admin_audit`.
6. Leave the Capital browser session open. In the Group Admin session,
   **revoke** the scope. Retry list/UPDATE directly with the still-signed-in
   Capital identity; both must now fail, without an extra audit event or
   updating the request.
7. Verify ordinary existing Group Admin functions, existing private client
   visibility, and rental/project functionality are unchanged.
8. Remove the synthetic Staging users and synthetic Capital Request after
   acceptance, and verify the scope/audit state matches the intended test
   record retention policy. Use Auth Admin API for user cleanup, and inspect
   foreign-key constraints before deleting seeded data.

## Automated checks already present

- `supabase/tests/phase3a_scoped_roles_staging.sql`
- `supabase/tests/phase3a_capital_scopes_staging.sql`
- `supabase/tests/phase3a_trusted_pilot_staging.sql`
- `node --test tests/phase3a-security.test.mjs`

SQL scripts use a handled subtransaction rollback for their synthetic data.
The native Node tests and GitHub workflow are static/read-only. Neither
replaces browser login or a direct API test with real user sessions.

## Release gate

Only propose a Production deployment after: all acceptance checks above
pass; isolated Preview and GitHub checks remain green; department RLS and
service-role paths have been reviewed; an exact schema migration/release plan
has been reviewed; and the owner gives explicit release approval.
