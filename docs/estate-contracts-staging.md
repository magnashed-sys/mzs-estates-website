# Rental relationships, contracts and monthly invoice drafts

The owner approved publishing the administration module on 24 October 2026 so real relationships and agreements can be entered and reviewed. Production and Preview each require their exact matching Supabase project. Only active full Group administrators may use the routes, server actions, data and private documents. Saving a rental relationship does not create an Auth account, activate a client, grant access or send an invitation.

## Current workflow

- Rental relationships: create/edit a person or company, with optional billing address, email, phone and reference. Optimistic versions protect concurrent edits. Select a relationship to copy its billing details into a draft contract; later edits do not rewrite existing contract/invoice snapshots.
- Contracts: one or multiple units within a property, a legal tenant and landlord, optional existing login association, dates, monthly lines/VAT, deposit and notes. Billing addresses and IBAN may be omitted while drafting but are mandatory at activation. Unknown utility advances stay empty until confirmed or removed.
- Cutover: first MZS invoice period is December 2026 or later. Drafts are prepared on the 14th of the preceding month. December 2026 therefore prepares on 14 November 2026 and has a payment deadline of 30 November 2026 (received before 1 December).
- Daily scheduler catches up eligible periods; it never prepares a future scheduled period. Only explicitly activated contracts are included. A unique contract/period key and row locks prevent duplicates. The public RPC takes no date or amount input.
- Partial months use calendar-day proration when selected. VAT is calculated per line. Deposit is not a recurring line. Subject placeholders `{unitadres}`, `{maand}`, `{jaar}` use the rental period and selected NL/EN/ES language.
- Activated terms are immutable. Stop a schedule, then create a replacement beginning with the next uninvoiced month. Existing drafts and audit records are preserved.
- Review records who checked a draft. It is not an approval to send. **Final invoice numbering, final PDF generation, issuing, corrections, email delivery and payment tracking are not implemented/enabled in this release.** Complete and test those before the first actual invoice dispatch.
- Signed agreement attachments: private PDFs, max 10 MB, active Group-admin only; viewing URLs expire after 60 seconds and open in a new tab.

## Security changes

Browser roles have no INSERT permission on invoice drafts or audit records. Invoice generation runs through a private SECURITY DEFINER entry point which requires a non-null `auth.uid()` and the existing active Group-admin check. Its search path is empty and objects are qualified. The public RPC remains SECURITY INVOKER. The date-driven core generator is not executable by authenticated, anonymous or service roles; only the trusted database scheduler/owner can call it. Audit insertion is a private trigger with no browser EXECUTE grant, and actor identity comes from `auth.uid()`. These narrow privileged functions are necessary to remove direct INSERT rights without removing authorization checks.

## Deployment

Apply migrations in order: `20261024081252_estate_contract_drafts.sql`, then `20261024085449_lease_production_controls.sql`. Staging already had the first migration. No Staging contract, profile or test fixture is imported to Production.

After checking schema/policies, run the appropriate operational SQL: `supabase/staging/estate-contract-schedule.sql` or `supabase/production/estate-contract-schedule.sql`. Jobs run daily at 05:15 UTC and determine the business date in Europe/Amsterdam. Actual processing starts on each contract's 14th; a daily catch-up allows recovery from missed runs. Check `cron.job_run_details`. The Production job can be stopped with `cron.unschedule('mzs-production-lease-drafts')`; this preserves saved relationships/contracts/invoices. Reverting the application to the previous release hides the module without deleting data.

## Verification

`npm test` runs the actual ordered migrations in PGlite. Coverage includes forbidden direct invoice/audit inserts even for admins, denied private generator calls, client/inactive/anonymous denial, offline relationship creation, incomplete draft versus activation, pre-cutover rejection, month/year boundaries, proration/VAT, invoice uniqueness, immutable terms and audit attribution.

`MZS_PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser/lease-contracts.cjs` tests the built application with in-memory local Auth/database fixtures: create rental relationship, select it on a contract, safely type invalid/partial month values, save → activate → prepare → review → repeat, and mobile/desktop layouts. It never sends emails or accesses actual client accounts. Chromium explicitly simulates unsupported month input fallback. Native Safari and real signed-in PDF upload remain user acceptance checks.

Before release: optimized build, TypeScript, GitHub CI, rolled-back Staging database workflow and security advisors. After release: matching Production commit/READY deployment, anonymous route denial, empty initial production contract/relationship/invoice tables, private PDF bucket and active scheduler. A future scheduled run cannot be claimed as already tested live.
