# Phase 3 — annual administration collection

The Accountancy hub now opens an entity/year administration with original supplier costs, separate review metadata, renovation/improvement projects, a seven-section collection checklist and one accountant ZIP. The existing sales serializer is shared with the original partial sales export.

## Scope and source preservation

- Create an administration for an existing legal entity and a year between 2000 and 2099. Configuration seeds MZS Estates 2023 as a historical reference, and MZS Estates/Mase Estates 2026 as current collections, resolving the entities by verified tax identifiers. No 2025 setup and no source amounts are imported by this release.
- Retain the original 2023 VAT source treatment. The owner's current no-recovery statement is recorded as a note; the effective date and supporting confirmation remain pending. Selecting confirmed no-recovery requires a date and evidence. No VAT deduction/refund or fiscal adjustment is calculated.
- Record original supplier invoice net/VAT/gross amounts as immutable purchase concepts. Company overhead has no property allocation; property costs retain the existing dated paying-entity validation. The entity/supplier/normalised-invoice-number duplicate rule and append-only source audit remain in force.
- Review costs separately as pending, reviewed or excluded. Reviewed requires an evidence reference; excluded requires a reason. Categorisation and project assignment cannot change source amounts. Projects belong to one entity/year; cost reviews must match the year and property scope. Every change has an immutable before/after audit and actor. Revisions prevent stale form submissions from overwriting later reviews.
- Categories: advice, utilities, maintenance/repairs, renovation, improvements/extensions, insurance, bank charges, depreciation, taxes, management and other. Gross collection totals are not final deductible expenses or capitalisation decisions.
- The seven manual checks cover income, costs, bank reconciliation, assets, financing, tax and documents. They record a review at the time of saving, not a closed accounting period. Recheck after changing sources.

## Export

A security-invoker RPC reads a single consistent entity/year snapshot and rejects unsupported size rather than silently truncating. The ZIP includes:

- Existing issued sales, credit notes and dated receipt events in `sales/`, retaining the existing cross-year and reversal rules.
- Original supplier costs with allocations, review status, evidence, exclusion reasons and category totals.
- Year projects and a private-document index with original checksums; PDF bytes remain in the existing archive.
- Historical invoice snapshots for the selected issue year, explicitly reference-only, with exclusions retained. These are never automatically added to issued sales or treated as payment events.
- Capital register references for the entity across all periods, explicitly contextual, without invented annual balances, repayments or accruals.
- Configuration, manual checklist, coverage, unresolved exceptions, EN/ES instructions and a SHA-256 manifest.

The package explicitly excludes unverified bank movements, missing asset registers, unallocated staff statements, opening balances and fiscal adjustments. It does not submit a Spanish tax return, send accountant emails, post journals or calculate final tax. File columns remain stable English; interface and instructions support English/Spanish, preserving original data text.

## Validation

- 409 automated tests, including PostgreSQL/PGlite RLS, active-admin access, original amount immutability, payer dates, company/property scope, duplicate prevention, evidence requirements, cross-year/project rejection, optimistic revisions, audited changes and no anonymous/client access.
- Unit tests verify separate gross totals, historical-year selection, CSV formula protection, exception coverage and every manifest hash. All pre-existing sales export event/credit tests pass against the shared serializer.
- Production build and TypeScript checks.
- Real Next.js HTTP integration with synthetic local Supabase: authenticated EN/ES pages, server actions for settings/cost entry/review, duplicate and stale-revision handling, filters, ZIP route, failed-source rejection and access denial. No claim of a full graphical browser test.
- Staging migration and real PostgreSQL snapshot smoke test under an active-admin role; synthetic test dossier rolled back.

## Operational use

Open Accountancy → Year administrations. Review setup, add projects as needed, enter or review supplier costs, resolve the collection checklist, and download the package. Bulk source imports should be analysed and matched to these entities, suppliers, categories and invoice references before any data is entered. Automatic PDF/OCR posting and bulk import mapping are outside this release.

Existing runtime scopes, external message behavior, invoice/payment records and original archived PDFs remain unchanged. Rollback can restore the previous frontend; new metadata and audits should be retained, not destructively removed.
