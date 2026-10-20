# Private Capital: loans and agreements

Status: Staging review only. Production publication and migration are not authorised by this change.

## Delivered

- Full-administrator-only `/admin/group/capital/deals` and per-deal dossiers.
- Loans provided/received, actual lender/borrower identity, original principal,
  annual rate, agreement/funding/maturity dates, workflow and review status.
- Manually sourced interest/principal/fee schedules; dates do not imply payment.
- Confirmed partial/full payments require actual date and evidence reference.
  The database serialises per-instalment entries, rejects overpayment/future
  dates, and prevents silent edits. Repeated forms carry a unique payment ID.
- Incorrect payments can be voided once with a reason; immutable audit retained.
- Private PDF storage (20 MiB), retained uploads/version labels and short-lived
  download URLs opening in a new tab. No client publication or e-signing.
- Full admins only, including database and Storage RLS. Capital department scope
  does not grant access. Each page/action/download route independently checks
  active full admin and strict Preview + Staging URL before reading data.
- No emails, no project/relationship grants, no production changes.

## Data and documents

Two owner-approved source dossiers and 19 planned entries were imported into
Staging through the controlled database connection. All payment records remain
unconfirmed. Source contract values, identities and PDFs are NOT committed.
On 20 October the owner confirmed document upload/download. Database inspection
confirmed three attached PDFs across the two real dossiers and no missing Storage
objects. A duplicate schedule must not be imported as another loan.

The maturity of one source loan is not established by its last interest date.
One final interest instalment must remain exactly as supplied until its basis
is confirmed. Do not fabricate interest accrual conventions or payment evidence.

## Tests performed

- TypeScript and Next.js production build passed (existing CSS warnings only).
- Existing seven Phase 3A tests passed.
- New runtime guard tests cover production/misconfigured Preview, no session,
  ordinary/scoped/inactive roles and full admin.
- Staging SQL test exercises admin create, partial/full payments, overpayment,
  future date, duplicate ID, immutable amounts, void/correction, audit retention,
  document metadata and client/scoped/inactive/anonymous denial.
  All synthetic fixture changes roll back. This tests database permissions,
  not actual binary PDF upload/download or an authenticated browser flow.

## Acceptance recorded — 20 October 2026

The owner reported successful full-admin dossier access, document operation,
partial payment and void/correction on a separate synthetic dossier, and access
refusal for a non-administrator account. Database inspection confirms that the
synthetic dossier has one payment, voided, and the real dossiers have no payments.
Three document metadata records resolve to existing private Storage objects.
These reports do not establish a separate mobile review or an inactive-account
browser test; inactive profiles were covered by automated guard/SQL tests.

Production preparation and remaining release gates are documented in
`private-capital-deals-release.md`. No production migration or merge performed.

## Limits / next iteration

No bank import, automatic reconciliation, late-payment assertion, automatic
interest engine, e-signature or client sharing. Original principal is not a
reconciled outstanding balance. Existing instalments are retained and cannot
yet be rescheduled/voided through the UI; changes require a reviewed follow-up.
Lists fail closed if the complete configured row limit cannot be loaded.
Audit screen shows the latest 30 entries; full audit remains in the database.
Simultaneous edits to deal descriptions currently use last-save-wins;
payment changes are separately guarded and audited.

## Release / rollback

The feature is intentionally 404 outside Preview + MZS Staging. To publish,
obtain explicit owner approval, verify backup, prepare Production migration and
source import, add production enablement deliberately, and retest all guards.
Do not promote this Preview directly or merge the draft PR without that review.
Rollback the Preview app or remove its feature exposure; retain deal data and
audit. Never drop financial records as a casual rollback. Existing schemas,
grants, auth accounts, production domains and SMTP settings are unchanged.
