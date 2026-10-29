# Supplier payment administration — isolated Staging pilot

## Purpose

MZS holds immutable supplier purchase draft amounts and separate annual cost reviews. Rental, booking and Capital receipt records are NOT purchase payment evidence. This pilot adds an append-only register of manually declared existing payments for reviewed supplier costs, with partial payments, idempotent retry and administrative reversals.

An administrator-recorded supplier payment is NOT a verified bank payment. An invoice balance that has no matching manual payment record is NOT proof that the invoice remains legally unpaid or overdue. A reversal corrects the internal register and does not imply a bank refund. Credits, advances, amounts above the invoice balance, cross-invoice splits and automated bank imports remain excluded. The accountant remains responsible for tax treatment and statutory accounting.

## Data and authorization

Staging-only additive migration 20261029201806_supplier_payment_ledger_staging.sql creates two empty tables: mzs_accountancy_supplier_payments and mzs_accountancy_supplier_payment_reversals. Both are RLS-protected with active Group Admin SELECT only. Authenticated users have NO direct table INSERT/UPDATE/DELETE grants. Immutable triggers forbid rewriting historical rows.

Only public.mzs_record_supplier_payment and public.mzs_reverse_supplier_payment are callable via authenticated, owner-checked, invoice-locking SQL RPC. All sensitive checks repeat in the database (active admin, draft issuer, review status, date, EUR integer cents, duplicate reference for the invoice, remaining invoice amount, replay UUID and reversal reason). An invoice that has not been explicitly reviewed is blocked. An existing payment is never overwritten. The source RPC returns the full history and reversal details to authorized administrators only.

## Interface and accountant ZIP

The year-administration pilot link appears only when Vercel Preview uses MZS Staging Supabase and has the explicit MZS_SUPPLIER_PAYMENTS_ENABLED=true flag. The pilot page lets a signed-in admin record real prior payments and reverse incorrect registrations, with unmistakable payment evidence pending bank reconciliation. No funds are transferred by the platform.

When enabled, accountant ZIP includes supplier-payment-events.csv and supplier-payment-summary.csv, alongside existing source files and SHA-256 manifest. Neither export nor UI claims that MZS has automatically reconciled the bank. No tax return, VAT recovery, general ledger or final closing entries are produced.

## Gates and rollout

1. Confirm migration was applied on isolated Supabase Staging only; ensure zero new real payments and unchanged existing costs.
2. Complete isolated database tests with admin/client/anonymous roles, concurrent sum limits, idempotency, duplicate reference and reversal immutability.
3. Enable the pilot flag only on its assigned Staging Vercel Preview (not Production) and complete an authenticated admin desktop/mobile transaction and export test using synthetic data.
4. Review backups and Production-specific migration/release steps. Any Production payment write activation needs an explicitly verified schema and live browser acceptances. Production code may be shipped disabled; that does not constitute activation of financial payment administration.

Subsequent work: optional bank reconciliation evidence and matching per legal issuer, separately approved credit/advance workflow, split payments between invoices, and verified reporting in the Financial Cockpit. No automatic posting of real supplier payments.
