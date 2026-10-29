# MZS Accountancy — supplier-payment Production readiness

## Verified Staging acceptance

On 29 October 2026 the owner used the Staging administrator account to review the synthetic supplier invoice TEST-PR188-2026-001 and register two fictitious payment entries, EUR 0.50 (28 October) and EUR 0.71 (29 October). The owner then administratively reversed the EUR 0.71 entry with reason "testcorrectie". The original record remains: current active recorded Staging amount is EUR 0.50, and the remaining test amount without an active entry is EUR 0.71. This is NOT real bank payment evidence.

Negative access and database checks passed with an ordinary client and transactional admin tests: client cannot read/write the payment ledger, repeated request IDs are idempotent, duplicate references and overpayments are rejected, correction rows are immutable, and synthetic test transactions were rolled back. The user-confirmed end-to-end accountant ZIP download is still pending separate verification, while exported CSV logic is covered by automated tests.

## Two independently guarded modes

Staging synthetic mode requires VERCEL_ENV preview, the exact MZS Staging Supabase URL and the branch-scoped MZS_SUPPLIER_PAYMENTS_ENABLED=true flag. The UI and server action demand a confirmation specifically identifying fictitious Staging test entries; no real bank or cash movements may be recorded there.

Production real mode requires VERCEL_ENV production, the exact MZS Production Supabase URL and a DIFFERENT, separately authorized MZS_SUPPLIER_PAYMENTS_REAL_ENABLED=true flag. The Staging flag must be absent. The UI and server action demand confirmation that the amount, date and source reference belong to a transfer or cash payment that already occurred. A Staging test confirmation cannot authorize the Production action; conversely a real-payment confirmation cannot authorize synthetic Staging entries.

Without the exact project/environment/flag combination, all supplier payment pages/actions remain inaccessible. The Production flag is deliberately NOT configured, and the Production database does NOT have the supplier payment schema.

Regardless of mode, the ledger is admin-attested evidence, NOT independent bank reconciliation. Original amounts are stored as EUR integer cents, only against explicitly reviewed supplier costs, with entity scope, immutable audit records, idempotency and strict overpayment protection. The system never initiates bank transfers, determines VAT deductibility, posts statutory accounts, invents due dates or allocates advances across invoices.

Accountant ZIP exports receive the payment mode from the server. Every event/summary row distinguishes synthetic_staging_only and real_transfer_attested; both modes retain bank reconciliation NOT verified, explicit correction history and a legally separate source-limitation statement. A missing internal record is not proof of unpaid or overdue amounts.

## Release gates

1. Verify current Production backup/restore, migration dependencies and exact issuer attribution. Review the existing, isolated Staging-tested supplier payment SQL migration before Production application.
2. Obtain explicit owner approval before Production migration and enabling the real financial write flow. Merely approving Staging UAT is not sufficient.
3. Run admin/client/anonymous permission tests, concurrent idempotent writes, duplicate-reference and overpayment negative cases, correction and journal immutability on Production in transactions that fully ROLLBACK.
4. Perform a real authenticated administrator browser acceptance of the Production-specific UI and accountant ZIP, with approved, evidenced transactions and a restricted pilot policy.
5. Verify no Financial Cockpit amounts are affected automatically. Bank statement matching is a separate module and is NOT implied by this ledger.
6. Verify Production deployment alias, errors, exports, and the empty initial payment tables.

Issue #196 remains open until the separate real-payment production readiness gates succeed. No Production payment or actual supplier invoice amount was modified by this work.
