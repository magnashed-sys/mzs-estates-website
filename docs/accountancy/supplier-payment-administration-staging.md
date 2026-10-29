# Supplier payment administration — isolated Staging pilot

## Purpose

MZS holds immutable supplier purchase draft amounts and separate annual cost reviews. Rental, booking and Capital receipt records are NOT purchase payment evidence. This pilot exercises an append-only register with **synthetic Staging-only payment entries** for a reviewed fictitious supplier cost, including partial amounts, idempotent retry and administrative reversals. It is NOT a production register of actual transactions.

A synthetic Staging payment entry is NOT a real or verified bank/cash payment. An invoice balance that has no matching manual payment record is NOT proof that the invoice remains legally unpaid or overdue. A reversal corrects the internal register and does not imply a bank refund. Credits, advances, amounts above the invoice balance, cross-invoice splits and automated bank imports remain excluded. The accountant remains responsible for tax treatment and statutory accounting.

## Data and authorization

Staging-only additive migration 20261029201806_supplier_payment_ledger_staging.sql creates two empty tables: mzs_accountancy_supplier_payments and mzs_accountancy_supplier_payment_reversals. Both are RLS-protected with active Group Admin SELECT only. Authenticated users have NO direct table INSERT/UPDATE/DELETE grants. Immutable triggers forbid rewriting historical rows.

Only public.mzs_record_supplier_payment and public.mzs_reverse_supplier_payment are callable via authenticated, owner-checked, invoice-locking SQL RPC. All sensitive checks repeat in the database (active admin, draft issuer, review status, date, EUR integer cents, duplicate reference for the invoice, remaining invoice amount, replay UUID and reversal reason). An invoice that has not been explicitly reviewed is blocked. An existing payment is never overwritten. The source RPC returns the full history and reversal details to authorized administrators only.

## Interface and accountant ZIP

The year-administration pilot link appears only when Vercel Preview uses MZS Staging Supabase and has the explicit MZS_SUPPLIER_PAYMENTS_ENABLED=true flag. The pilot page lets an authenticated administrator simulate fictitious partial payments and corrections against the existing synthetic invoice only. The form and server action require explicit **synthetic Staging test** acknowledgement; a claim that a real transfer happened is not acceptable. No real bank or cash transaction occurs.

When enabled, the accountant ZIP contains supplier-payment-events.csv and supplier-payment-summary.csv with a mandatory synthetic_staging_only flag and prominent EN/ES synthetic-data notice, alongside existing source files and the SHA-256 manifest. These Staging exports must NEVER be shared as records of real payments. Neither export nor UI claims bank reconciliation. No tax return, VAT recovery, general ledger or final closing entries are produced.

## Gates and rollout

1. Confirm migration was applied on isolated Supabase Staging only; ensure zero new real payments and unchanged existing costs.
2. Complete isolated database tests with admin/client/anonymous roles, concurrent sum limits, idempotency, duplicate reference and reversal immutability.
3. Enable the pilot flag only on its assigned Staging Vercel Preview (not Production) and complete an authenticated admin desktop/mobile transaction and export test using synthetic data.
4. Review backups and Production-specific migration/release steps. Any Production payment write activation needs an explicitly verified schema and live browser acceptances. Production code may be shipped disabled; that does not constitute activation of financial payment administration.

Subsequent work: optional bank reconciliation evidence and matching per legal issuer, separately approved credit/advance workflow, split payments between invoices, and verified reporting in the Financial Cockpit. No automatic posting of real supplier payments.
