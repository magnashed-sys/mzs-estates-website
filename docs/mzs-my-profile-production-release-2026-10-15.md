# MZS Group — My Profile & My Companies: production release plan

Status: **READY FOR OWNER RELEASE APPROVAL — DO NOT MERGE AUTOMATICALLY.**
Date: 15 October 2026
Release branch: `feature/member-profiles-company-relationships`
Pull request: https://github.com/magnashed-sys/mzs-estates-website/pull/4
Staging Supabase: `senonkpxdtlhyhrubicg` (isolated).
Production Supabase: `ptrnjzmcehrhbsfxntgw`.

## Features being released

- New private `/private/profile` route and `My Profile` link for approved clients/partners.
- Self-managed personal full name, phone, postal address and NAW fields.
- Verified email change through Supabase Auth, with canonical account email
  synchronized to `profiles.email` and `email_normalized` **only when
  Auth performs the change**, not directly from an untrusted form.
- Password changes require the current password. Minimum length: **8 characters**.
- `My Companies`: self-declared company entries (legal/trading name,
  registration number, country, relationship type, optional notes), multiple
  per member; create, edit, delete.
- Company entries do **not** verify ownership or grant access to projects or
  other members. Existing project permissions are independent.

## Staging acceptance

- Vercel staging Preview build READY, all isolation readiness flags true.
- Personal NAW information entered through UI, confirmed in Staging database.
- Two synthetic companies created; relation changed Director → Shareholder;
  one company deleted; remaining company persisted.
- Email change completed and account email synced across Auth/Profile.
- Password changed and owner confirmed they could log back in.
- Following account changes: active, confirmed email, 4 project grants,
  5 offering grants, retained company and address.
- RLS verified: a different client cannot read or write another client's
  companies or create a company for another user.
- Inactive members cannot edit contact data or create/read private company
  or address records.
- Rolled-back SQL tests verified canonical email synchronization, updating
  contact info and performing company CRUD. No test record left by those
  security tests.
- Supabase Security Advisor inspected. The new authenticated
  security-definer RPC has deliberate, explicit caller/role/length checks.
- All staging test runs took place outside Production.

## Production baseline — read only, before release

- 12 auth users and 12 active members.
- 34 project grants, 42 offering grants.
- 12 invitations, 18 requests.
- No duplicate normalised profile emails.
- New company/contact tables NOT yet present on Production (expected).
- Production Vercel build READY at commit
  `a3d4f3e3c4da7773706f37801f9eb4823103b0b6`.

## Owner preconditions BEFORE applying migration

1. Confirm recent available backup at Supabase **MZS Production** >
   Database > Backups. Confirm the actual restore point timestamp.
2. In Supabase **MZS Production** > Authentication > URL Configuration,
   add `https://www.mzsgroup.eu/private/profile` to Redirect URLs
   without removing existing registration, recovery, or invite entries.
3. Ensure **Secure email change** is enabled in Production and the
   existing email-change templates / SMTP settings remain correct.
4. Owner explicitly approves migration and deployment for this feature.
5. Confirm the new Preview branch did not accidentally inherit Production
   credentials (already verified by isolated readiness test).

Never share secret keys, recovery links, or passwords in chat.

## Controlled release after approval

1. Recheck Production baseline and current `main` commit and Vercel READY status.
2. Apply only the additive
   `supabase/migrations/20261015_member_profile_companies_v1.sql`
   to **MZS Production**. Do not run staging data seeds.
3. Verify the two RLS-protected tables, the secured contact RPC and the
   Auth email-sync trigger. Verify all existing account and permission
   counts remain unchanged.
4. Mark GitHub PR #4 ready and merge to main after Vercel build checks pass.
5. Wait for new Vercel Production READY deployment.
6. Operator live smoke test: active client login, My Profile navigation,
   contact info, multiple companies, email request, password change,
   Dashboard/reservations/projects, existing roles.
7. Confirm all pre-existing projects, bookings, login and mail workflows
   remain operational and no company record grants project access.
8. Keep staging and synthetic test companies separate from Production.

## Rollback / stop conditions

- If the schema migration fails, do not merge.
- If no recent Production backup is available, stop.
- If Auth email redirects are incomplete, stop before testing changes.
- If the new Production Vercel build fails, investigate and revert app
  deployment while preserving newly created data.
- Database migration is **additive**. Do not drop any of these new tables
  if live profiles/companies have been created without explicit backup,
  consent and data handling plan.
- Never touch existing auth users, project rights, invitations or bookings
  as part of migration.
