# Rental contracts and monthly concept invoices — Staging

This first release links agreements to the existing 22 rental units and prepares monthly concept invoices. It is guarded to Vercel Preview with the exact MZS Staging project URL. Production remains unavailable even if the branch is accidentally merged; removing that guard is a separate owner-approved release.

## Delivered workflow

- Active Group administrators can create/edit draft contracts, select one or multiple units from the same property, optionally link an existing account, record a person/company tenant, and set the issuing landlord, address and bank details. Creating a lease does not create a login or change client rights.
- Separate contract date, lease dates, first invoice month in MZS, and first preparation date prevent historical re-invoicing at cutover. Frequency is monthly, with optional maximum terms. Billing day stays anchored across short months.
- Recurring subject uses `{unitadres}`, `{maand}`, `{jaar}` from the rental period, with EN/NL/ES month names. The unused periodic assignment subject is omitted.
- Separate line amounts and VAT choices; optional calendar-day proration; deposit is recorded outside recurring charges. Unknown utility advances remain unknown when suggesting unit amounts.
- Activation locks terms. Active contracts can stop billing without deleting history or implying legal termination. Revised terms require a replacement draft with the next uninvoiced period. Overlapping active unit agreements and replacement billing of already drafted periods are rejected.
- Daily Supabase Cron on Staging catches up due months. Manual preparation uses the same function. Database uniqueness and locks prevent repeated processing from duplicating a period. Stored snapshots preserve calculated amounts and parties.
- Draft review notes/status and append-only contract/invoice audit history. Checking a draft is not invoice issuing. No final numbers, payment collection, emails or credit notes exist in this release.
- Private PDF attachment bucket, 10 MB/file, active Group-admin-only storage policies and 60-second viewing links in a new tab.

## Staging operations

Apply `supabase/migrations/20261024081252_estate_contract_drafts.sql` to MZS Staging only. Then explicitly apply `supabase/staging/estate-contract-schedule.sql` to Staging: daily at 05:15 UTC, using Europe/Amsterdam to determine the billing date. Only contracts explicitly activated by an administrator are processed. Production is not scheduled.

Check `cron.job_run_details` for execution results. To disable this schedule without deleting data: `select cron.unschedule('mzs-staging-lease-drafts');` on Staging.

## Validation

`npm test` includes a real PostgreSQL-compatible PGlite run of the migration and lifecycle, duplicate/overlap controls, old-platform cutover, catch-up, term limits, end dates, leap/month ends, calendar-day prorating, VAT rounding, placeholders, locked terms, review audit and admin/client/inactive/anonymous access tests.

`MZS_PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser/lease-contracts.cjs` runs the built application with local in-memory Supabase/auth fixtures: create → activate → prepare → review → repeat, empty unknown advances, live subject preview, mobile/desktop overflow and access denial. It never connects to real client accounts or sends messages.

Run optimized build and TypeScript. After Staging migration, verify table policies, private storage bucket, zero imported/activated contracts and security advisors. Existing unrelated advisor findings are outside this change; no lease-module finding was reported. Advisor references: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security.

## Owner acceptance and next increment

- Open Property Cockpit → Contracts & invoices with the existing Staging Group-admin account.
- Create a test draft using one or more units. Check landlord, tenant, starting period, amounts, VAT choice and subject preview.
- Activate only the intended test agreement. Use a due first preparation date to review concepts immediately; future dates wait until due.
- Confirm signed PDF upload and opening with the real Staging account (automated browser tests use synthetic auth and do not upload real agreements).
- Before Production: approve invoice design, final numbering per issuer, editable concept corrections/credit workflow, legal/tax settings, historical migration scope and cutover month. Issuing/email delivery, automatic indexation, tenant access, entity master data and banking/accounting integrations are later increments, not silently enabled.

Do not stop the old billing platform until the Production cutover and comparison have been approved. Existing contract documents, start dates and VAT treatment have not been guessed or imported.
