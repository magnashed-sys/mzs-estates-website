# Financial Cockpit + Property Operations — Staging preview

Prepared 28 October 2026 · **Draft PR #143 only** · Production unchanged.

## Existing Financial Cockpit stays authoritative for its current meaning

The existing `GET /api/admin/financial-cockpit` and its `buildFinancialPhase2` contractual rental and loan-interest calculations remain **unchanged**. They distinguish contracted rent forecast, loan-interest schedule, actually recorded rent and loan interest movements, and independently quoted future guest bookings. They are not already a full statutory profit/loss or bank reconciliation.

**Never subtract a purchase invoice from "Recorded net cash movements"** unless a separate, verified and dated supplier payment exists. Supplier expenses are currently booked as reviewed *cost evidence*, not a cash event.

## New isolated preview integration

In `app/admin/FinancialCockpit.tsx`, a staging-only component `PropertyOperationsFinancialPanel` appears beneath the existing verified reports when `NEXT_PUBLIC_SUPABASE_URL` points to the isolated MZS Staging project.

The panel requests `GET /api/admin/property-operations-costs?year=<YYYY>&entity=<all|unassigned|issuer-uuid>`. The API additionally verifies `VERCEL_ENV === preview`, the exact database URL, the authenticated active Group Admin role, valid year/issuer selection, and complete exact-count pagination of each existing financial source register. Unavailable or inconsistent sources produce **no apparent financial totals**. It does not issue emails, invoices, payments or database writes.

The source registers are the existing `mzs_ops_expense_drafts`, original evidence, final supplier-cost review events, correction requests/decisions and linked approved replacements. Physical property names are read from `mzs_estate_properties` by explicit ID; the system never guesses legal ownership from a property name.

### Amount inclusion

- **Approved supplier costs:** the latest review event is `approved`, a valid original document is registered, and no unresolved or replacement-required correction exists. Net, VAT and gross are retained separately, with integer-cent precision. Include an independently approved corrective replacement invoice under its **own date and entity**, and exclude the superseded original when a correction was required.
- **Draft / submitted:** shown in a separate pending area, never counted as approved costs.
- **Rejected / corrections:** shown in an attention area; no silent cost or profit influence.
- **Declined correction proposal:** the previously approved original remains approved; its correction and decline are retained as audit records.
- **Approved corrective invoice not yet linked:** may be independently approved, but has no confirmed original/supersession until linked. Source provenance must be reviewed; no automatic guessing from amount or text.
- **Date basis:** original supplier invoice date, **not** payment date or service period. Amounts are invoices including VAT; they are **not** tax deductibility, booked profit or cash paid.
- **Unassigned reporting scope:** no supplier expenses are attributed by guess; expense drafts require a verified legal entity. Group-wide totals are internal management arithmetic only.

The panel provides chosen-month approved gross, full-year approved net/VAT/gross, pending/attention counts, monthly cost series, and cost breakdown by registered physical property and cost category. Its own explicit cash-paid flag remains `false` until a supplier payment module is implemented.

## Financial quality gates

- Read count and exact unique ID across all pages and tables; reject if counts change or an entity/property is unknown.
- RLS and active-admin authorization server-side; fail closed on missing documents for approved supplier costs.
- Preserve and validate replacement lineage, approval, source and exact legal entity. If an original has a replacement-required decision it never counts twice; replacement may be counted only after its independently verified approval and original source.
- No mixing of admin test entries, historical WhatsApp amounts or Catherine/Zorgbalans 7113 into real records.
- No inferential currency conversion, VAT rates, unverified payment dates or bank movements.
- Monthly numbers and financial reports continue to use the same year/entity selection from the existing Financial Cockpit; they are not combined with existing rent/loan cashflow KPIs.

## Acceptance tests

- [ ] Company issuer and private-person issuer have distinct property costs; group-wide total adds only explicitly approved costs.
- [ ] Two registered physical properties and their units show separate category totals.
- [ ] One original approved expense with `replacement_required` and one independently approved replacement: only replacement counts, original remains auditable.
- [ ] `declined` correction restores the original approved amount without a second entry.
- [ ] No original document, duplicate evidence, duplicate review, invalid cents, unknown entity/property, overlapping replacement or missing pages causes an incomplete apparent total.
- [ ] Month and year changes refresh the cost preview, do not modify contractual rental forecasts, rental/loan receipts or saved finance CSV.
- [ ] Client/Partner/inactive admin cannot access the new API or source registers; Production access to the endpoint returns 404.
- [ ] Mobile Staging preview reviewed, with all totals labeled as *supplier costs by invoice date, not payments*.
- [ ] The next phase must add approved supplier payment recording and a stable cost vs receipt versus bank reconciliation. No Production release until user approval.

**Staging preview code only.** No extra database migration is needed: this reads the Staging tables already provisioned in PR #143.
