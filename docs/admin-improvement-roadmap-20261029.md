# Authorized sequential admin improvements

Owner authorized on 29 October 2026: prepare each improvement individually, test it, and publish after successful checks. Do not post real receipts, send customer messages or infer financial classifications as part of testing. Existing original invoice/archive data stays intact. PDF/manual document intake remains deferred. Accountant handoff is by exports, not a full bookkeeping/tax platform.

1. Financial consistency — current invoice balances in Cockpit and linked-customer historical invoice dossiers; dated imported receipt/reversal events in accountant exports. Implementation prepared in this release. Imported sales remain references, not newly issued invoices. Historical Gripp snapshots remain separately labelled. Only 2026 imported invoices enter Cockpit; additional dated receipts may reference older invoices in accountant exports without reposting those sales.
2. General standalone invoice creation — customer/entity, lines, draft review, definitive issue and controlled delivery, including personal branding rules.
3. Receivables follow-up — aging, customer/entity totals, follow-up dates/notes and explicit reminder sending.
4. Credit notes — controlled original-invoice linkage, partial/full credits and allocation.
5. Consolidated accountant package — prioritize Spanish property ownership/operation and renovation-project administrations; distinct advisory, utilities, maintenance, renovation and improvement groups, separate fiscal review and import readiness. Detailed owner requirements: `spanish-accountant-package-requirements-20261029.md`. Entity/period controls, completeness checks, exceptions and remaining source coverage.
6. Relationship dossier — broader finance/activity summary, notes and follow-ups without guessing cross-module identities.
7. Data completeness queue — missing entity/customer/property/billing associations with direct correction links.
8. Recurring property work — schedules, staff, deadlines and follow-up built on current maintenance/time workflows.

Small improvements to schedule with related steps: retain filters, direct invoice deep links, saved selections, remaining Dutch admin labels. Step 2 draft/issue/PDF/payment flow was released in PR174; initial invoice email delivery remains pending. Step 3 is implemented in this release with the scope described in `receivables-follow-up-20261029.md`. Step 4 platform standalone credit notes are implemented in this release (see `service-credit-notes-20261029.md`); other invoice sources and refund/transfer workflows remain pending. Steps 5–8 remain pending.

## Step 1 release verification

369 automated tests passed before final scope-label refinements; TypeScript passed. Includes actual Postgres-engine accountant RPC compatibility, event-date versus invoice-date tests, cross-year reversals, no duplicated imported sales, exact references and unmatched receipt failure. Staging DDL rehearsal rolled back successfully. Authenticated browser acceptance remains distinct from automated checks.

Rollback: previous production dpl_2Q1AzCtxBpzHeTZ69d1pLf87y3rp at d1d21b4a8768fb0af4c3bbeccb665b3477933e08. Retain additive RPC response fields on UI rollback; no source mutation or schema deletion is required. Align pilot release SHA on any application rollback.
