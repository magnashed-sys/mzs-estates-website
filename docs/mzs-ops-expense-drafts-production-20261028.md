# MZS Group — Supplier-cost draft foundation (Production step 3A)

**Scope:** two new, isolated and empty tables for immutable purchase-expense CONCEPTS and append-only audit. Not a finance ledger, not a complete invoice-management system.

## Safe boundaries
- Only an active Group Administrator can insert a concept. No UPDATE/DELETE or manual writing of approval/audit fields.
- All amounts are stored as integer euro cents. Net and VAT must reconcile exactly across the allocation. No auto-guessed tax rate.
- A dated, previously verified property/entity association with relation `payer` is mandatory for the invoice date; without it the database rejects writes.
- For every source supplier and issuing entity, invoice number must be unique. Every unit allocation must belong to the selected physical property and have a unique target. A whole-property allocation cannot be mixed with unit allocations.
- Supplier document status remains **missing** and approval remains **draft**, always. No payments, bank entries, outgoing invoices, e-mails, payroll or financial cockpit totals.
- All Production legal attributions are currently empty; do not assign them automatically. Administrators can review/record real legal evidence using the already published entity tool.
- This SQL never imports historical WhatsApp messages, Catherine data, or real supplier costs.

## Rollout
1. Exact-head test/build/security + READY Preview connected to Staging only.
2. Production DDL rehearsal inside `BEGIN ... ROLLBACK`.
3. Apply independently approved additive migration to Production and check 2 tables with RLS, anon denial, no direct authenticated UPDATE/DELETE, **zero rows**.
4. Compare existing bookings, contracts, receipts, Capital, owner stays, property units and pilot visits/tickets to the read-only pre-release baseline.
5. Separately release a guarded Group Admin cost calculator and concept-insert UI. New concepts can be saved only after real payer attribution; start with preview-only testing.

A ready backup was reported by the owner earlier; independent restoration of that backup was not demonstrated. These new isolated tables are additive and do not require any alteration to legacy financial records. Do not use a full database restoration for routine application rollback.
