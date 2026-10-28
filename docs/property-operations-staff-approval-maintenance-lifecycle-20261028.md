# MZS Property Operations — manager-reviewed staff visits & maintenance lifecycle

Staging-only follow-up, 28 October 2026 · PR #143 remains a Draft, no Production rollout.

## New working capabilities

- Admin may review each immutable actual work visit once: `approved` or `rejected`, reason required, with a separate administrator identity and review timestamp. A visit's originally entered `actual_minutes`, date, property, unit and description **never change** after review.
- When approving, manager can explicitly choose `not_billable` or `review_candidate`. The latter requires a **reviewed minimum number of minutes and rounding increment**, each in whole minutes, and calculates `billable_minutes` independently on that visit. These are **candidate minutes**, not confirmed customer charges.
- There is deliberately **no default Catherine tariff**, no VAT decision, no employee wage rate and no automatic client invoice. For example, under an independently confirmed 60-minute minimum and 60-minute increment, one 45-minute actual visit remains 45 actual minutes while the candidate is 60 minutes. Two visits of 30 minutes stay as two original records and create two separate 60-minute candidate snapshots only if each is individually reviewed.
- Admin may move a reported maintenance ticket through **triaged → scheduled → in progress → resolved → closed**, with a safe reopen path and required note on every step. The latest event determines the current state; no update or deletion of history.
- Optional work order reference is **internal planning text only**, not a supplier commitment, payment, email, purchase invoice or customer recharge.
- Staff members see the latest statuses of their own reported tickets only while they retain the assigned physical-property scope. Only Group Admin can review actual time or change ticket status.
- Both functions use append-only data structures with RLS, private trigger verification, no direct UPDATE/DELETE grants and active Group Admin checks.

## Scope protection

The underlying Staging staff tables and scoped directory views were already installed in PR #143. This slice adds two new tables: `mzs_ops_visit_reviews`, `mzs_ops_maintenance_events`. No changes to account roles or Production profiles. Catherine's Production account exists as an active client, **but is not copied to Staging, not added to a project or property, and remains unchanged**.

## Staging quality / release gate

1. Verify full CI tests, Next.js build, TypeScript and security guardrails on exact PR SHA.
2. Run in-memory PostgreSQL role tests for staff self-approval denial, admin approved visit and per-visit rounded candidate, duplicate decision denial, wrong state transitions, staff event append denial, and client access to one's own maintenance events only.
3. Apply this additive schema **only to MZS Staging** after the above pass.
4. Confirm RLS, zero unintended records and Supabase security advisor.
5. Run an authenticated browser smoke test using a **separately designated Staging staff test account**, never Catherine's Production identity.
6. No Production release without explicit user acceptance.

## Remaining phase-one acceptance items

- Scoped, private photo attachments to maintenance tickets; image metadata must not expose tenant/owner information.
- Dedicated staff correction/retraction workflow for erroneous visits or maintenance reports, with a supervisor audit.
- Supplier work orders with separate pricing approval and owner authorisation, no silent procurement.
- Explicit commercial terms, per-entity invoice issuance and recharging, matching approved visits to client invoices **without duplicating costs**.
- Consolidated accountant evidence and production-readiness plan, incl. migration audit and mobile visual tests.
