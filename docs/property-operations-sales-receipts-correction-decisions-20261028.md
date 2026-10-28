# MZS Group — invoice and registered-receipt export extension

Prepared 28 October 2026 · Staging-only PR #143 · No Production deployment.

## Delivered

The Estates/Property Operations admin page now contains an additional **issued sales invoices and registered receipt events** download. It is a separate ZIP rehearsal for the selected existing legal issuing entity and calendar year, and does not alter any invoice or receipt.

The exported sources are existing `mzs_lease_invoices`, `mzs_booking_invoices`, `mzs_lease_payments` and `mzs_booking_receipts`, not lease invoice drafts or booking quotes. Invoice rows are filtered by **issued_on** year; receipt events are filtered independently by **received_on** year. To capture a 2026 receipt against a 2025 invoice, the implementation reads issued invoices for the entity across years before reading linked payments.

The ZIP files are `issued-sales-invoices.csv`, `registered-receipt-events.csv`, `receipt-exceptions.csv`, `README.txt` and a SHA-256 `manifest.json`. Euro amounts are converted into integer cents using validated source strings. Booking invoice VAT/net fields must reconcile; rental invoices without reliable VAT split show blank VAT/net rather than inventing a tax rate. A receipt's administrative reversal is a separate dated event, explicitly *not proof of a bank refund*. A historical booking settlement with unknown receipt date remains an exception; its cash date is never guessed.

Source attribution is strictly by `mzs_lease_invoices.issuer_id` and `mzs_booking_invoices.issuer_id`. Payment rows from unrelated entities must not be included. A booking receipt with no associated issued booking invoice cannot be reliably associated with an issuer, so it is **outside this pilot package**. No false 'all cash receipts' completeness claim is made. Broken counters, unauthorized access, too many records or source ambiguity fail closed without exporting a partial ZIP.

## Corrective review decisions

A separate append-only `mzs_ops_expense_correction_decisions` table and Staging-only admin action offer two outcomes for a previously proposed and reviewed change: `declined`, or `replacement_required`.

- `declined`: original, previously approved expense may be included in the purchase-only rehearsal ZIP again. Its document and prior approval remain immutable.
- `replacement_required`: original remains in the purchase exception list. No proposed amounts count as financial expenses; they must first receive supporting corrected invoice evidence and a new formal review.
- Both outcomes require the active Group Admin, explicit reason, a unique correction ID and one irrevocable decision. The original invoice, amount and source are never edited or emailed.

**Limitations:** This is *not* a final posted corrected invoice or a VAT credit note. Creating the true replacement and reconciliation remains the next protected workflow. The accountant downloads are still separate purchase and sales/receipt rehearsal packages, not an automatically consolidated fiscal handoff.

## Acceptance and safety

- Run exact-commit GitHub automated tests, security guardrails, Next.js build and TypeScript.
- Test correction decisions with in-memory PostgreSQL, including no client access, no duplicate decisions and no change to originals.
- Only after green CI, run the additive migration on **MZS Staging** (`senonkpxdtlhyhrubicg`). Check RLS, grants and security advisors. All test data must be rolled back.
- Validate actual authenticated desktop/mobile Preview forms and ZIPs before considering a release.
- Production must not receive the migration or PR merge without owner permission.
- No personal Catherine WhatsApp chat, real payroll data, lender details or invoice 7113 are automatically imported or emailed.

## Next slices

1. Proper audited replacement supplier invoice with new evidence, approval and explicit relationship to the superseded original.
2. Merge the legal-entity purchase + issued-sales + dated receipt reports after matching service dates, bank references, missing invoices, credits and payment reversals.
3. Staff/contractor scoped time logging and maintenance tickets with assigned properties, after explicit security role design.
