# Rental platform integration

This release adds a shared rental relationship register with tenant/owner/investor/partner roles and an optional explicit link to an existing login account. Linking records grants no login or project rights. Existing CRM accounts and member-declared companies are retained; no automatic matching, merging or overwriting occurs. Main Relationships and Companies link to the shared register and issuing entities.

Issuing entities store legal name, address, IBAN, tax/registration details and a unique invoice prefix. Each prefix starts at 000001 and cannot be edited through the application. Choose a new prefix that does not overlap the previous billing platform. Entity selection copies details to a draft contract; activation requires an explicit issuer. Historical contract and invoice snapshots remain unchanged when master data changes.

Unit pages display currently active agreements, tenant and agreement amount. A contract spanning multiple units shows its whole amount and explicitly does not allocate that amount to each unit. Imported unit figures remain labelled as references. No inferred occupancy or holiday booking availability is created.

## Invoice lifecycle

- Monthly preparation retains the December 2026 cutover, preparation on the preceding 14th, and due date on the last day of the preceding month.
- Checking a draft records review. A separate explicit approval issues an immutable numbered invoice. Issuance locks the draft and issuer sequence, and is idempotent per draft.
- The approved invoice has an authenticated, admin-only PDF endpoint. Embedded licensed DejaVu Sans supports the platform's European languages. Contract terms and invoice amounts are saved snapshots.
- Sending requires another explicit action and displays the saved recipient. Preview tied to Staging always captures the MIME message without connecting to SMTP. Production additionally requires `MZS_LEASE_INVOICE_SEND_ENABLED=true` and the existing trusted service-role/SMTP configuration.
- Mail preflight and PDF generation happen before claiming delivery. Claim and completion are distinct: browser roles cannot mark SMTP acceptance. A captured message is not delivery; SMTP acceptance does not prove inbox receipt. Ambiguous outcomes or abandoned `sending` claims are never automatically retried. Resolve these against provider logs before any administrative recovery. This release has no resend button for uncertain/accepted/captured messages.
- Partial receipts use a client request ID plus database invoice locks. Entries can be reversed with a reason, preserving history. No bank transfers are initiated. Overpayments and future receipt dates are rejected.
- Overview distinguishes outstanding/overdue issued receivables, recorded receipts, draft agreements/concepts, agreements ending within 90 days and a three-month billing estimate. Estimates are not received cash. Register reads paginate and fail closed rather than silently total the first API page.

## Validation

85 automated tests, including actual migrations on PGlite, exercise numbering/idempotency, approval locks, partial payment/reversal, overpayment/future rejection, trusted mail completion, admin/client/inactive/anonymous access, forecasts, VAT, periods and mail isolation. Local browser fixtures exercise the complete UI workflow, PDF attachment capture, mobile/desktop layout and denied access. No production accounts or tenant records are used.

The Staging migration and a transaction-only integration scenario passed; fixtures were rolled back. Security advisors reported no lease findings. Optimized build and TypeScript checks passed. Final CI/Preview must be green for the exact reviewed head before release.

## Release and limitations

Apply `20261024091451_rental_platform_integration.sql` before deploying the new UI. The existing Production version tolerates these additive changes, but new activation after this migration needs an issuing entity selected in the new UI. Roll back application and drop the new activation trigger only if rollback is needed before users create invoices; never discard invoice/payment tables or reset sequences.

Production email enablement is a separate release configuration. Bank reconciliation/import, credit notes, invoice cancellation, automatic reminders and tax determination are not implemented. Users select the agreed VAT per line; this release does not decide the legal tax treatment. Verify issuing entity details, a distinct numbering prefix and a real controlled test email before using live tenant delivery. Existing active legacy contracts without an issuer require a reviewed migration/mapping; never infer a landlord by name. Existing draft contracts can select an issuer normally.

## Acceptance follow-up — 24 October 2026

See [the targeted PR52 acceptance report](rental-pr52-acceptance-2026-10-24.md). PR52 had already been merged and deployed before this audit started. Two follow-up corrections freeze the issuer registration in the reviewed snapshot and align forecast half-cent rounding with PostgreSQL. Apply `20261024110718_rental_acceptance_snapshot_fix.sql` before releasing the corrective code. It is applied only on Staging; Production requires explicit approval. Existing invoices, payments and numbering are retained. Legacy snapshots without a registration number omit it rather than borrowing current master data. The corrected suite has 86 passing tests. The browser rerun was blocked by the audit runtime and is not reported as passed.
