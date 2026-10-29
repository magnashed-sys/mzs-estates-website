# Accountant package: Spanish property administrations

Owner direction, 29 October 2026: prioritize data preparation for Spanish tax filings by the entity's local accountant. Administrations cover ownership and operation of real estate, plus renovation projects. Prepare for subsequent data imports. The platform remains an internal administration and export tool; direct AEAT submission, automatic tax returns and a full general ledger are outside the agreed scope. This document records requirements, not implemented functionality or confirmed tax treatment.

## Cost grouping (English admin)

| Stable category | Admin label | Intended management use |
| --- | --- | --- |
| advisory | Advisory & professional fees | Accountant, legal, technical and other advisers; preserve subcategory and description |
| utilities | Utilities & running consumption | Electricity, gas, water, internet and other recurring consumption, with separate subcategories |
| maintenance | Repairs & maintenance | Routine maintenance, repairs and servicing |
| renovation | Renovation works | Work belonging to a renovation project; does not imply capitalisation or immediate deduction |
| improvements | Extensions & improvements | Extensions, conversions and improvement work; fiscal treatment still requires review |
| unclassified | To classify | Preserve incomplete imported classifications for review, never guess silently |

Additional groups (insurance, property taxes/community charges, management, financing and acquisition costs) can be added without changing existing category identifiers. Do not silently reclassify existing historical costs such as Catherine's source records.

## Independent dimensions

Each cost/document allocation identifies legal entity, property and optional unit, renovation project, management category and subcategory. Keep the legal owner, invoice recipient and paying entity distinct: payment by one entity does not establish another entity's deduction. Link supplier/customer using verified identities, not fuzzy names.

One invoice can be allocated across categories, units or projects within its verified legal entity. Preserve the original invoice and each original VAT component; allocated net/VAT/gross sums must match the document exactly, without duplication or rounding loss. Do not split one supplier invoice across legal entities without a separately evidenced transaction.

Fiscal treatment is a separate reviewed field: pending review, current expense, capitalised asset/improvement, project/development cost, private/non-business or another accountant-approved treatment. These are workflow categories, not automatic legal conclusions. Management category must never determine VAT deduction, capitalisation, depreciation or tax-return box mapping.

## Data to preserve for import and accountant review

- Entity legal name and Spanish tax identifier as applicable (NIF/NIE), jurisdiction, legal form and accountant-confirmed tax profile/periods. Do not infer IRPF, IRNR, corporate income tax or an IVA regime merely from a person's/company's name or a Spanish property address.
- Property ownership association, ownership share, cadastral reference where available, acquisition/start-of-use dates and supplied acquisition/value breakdown. Preserve source and effective dates; do not calculate depreciation or taxable imputed income from missing values. Project link and work period remain separate from ownership data.
- Supplier identity, country and tax identifier; supplier invoice number; internal registration reference; document type; original-document link for corrections.
- Invoice, operation/service, receipt and payment dates separately. Preserve service periods and the accountant-selected reporting period; never equate payment date with the VAT deduction period by default.
- Currency and recorded net, VAT and gross amounts; multiple VAT components per document. Store explicit VAT treatment (including pending review), deductible VAT amount/percentage separately from invoiced VAT, and separately evidenced withholding/other adjustments where present. Unknown values stay unknown, not zero. Retain original currency/exchange evidence if later importing non-EUR data.
- Payment evidence and outstanding balances separate from invoice recognition and tax treatment. Credit allocation and administrative receipt reversal are not bank refunds.
- Original import batch, source file/reference, row identity/hash, original raw values and document/evidence reference. Previously imported sales need not acquire reconstructed original PDFs. Manual PDF intake remains deferred; allow document links/references and flag missing supporting evidence for the accountant.

## User flow

1. Import into a review batch with explicit entity and source mapping; no automatic posting of financial records.
2. Preview original/mapped values, document counts and exact source/control totals. Detect duplicates by source identifiers and entity/supplier/document identity, with manual resolution of ambiguous candidates. Retries must not duplicate records.
3. Assign verified property/project/category allocations and review fiscal fields. Incomplete records remain visible in a review queue; drafts do not count as definitive costs.
4. Confirm the reviewed import; retain actor, timestamp and original values. Corrections append/revise with an audit trail; no silent overwrites of issued documents or historical payment snapshots.
5. Select entity and month/quarter/year/custom period. Preview included sources, totals, exceptions and missing data before exporting.

## Accountant package

Provide one download containing a reconciliation summary, issued invoices, separate credit notes, received invoice/cost register, registered payment events, property/project allocation detail, supplied asset/improvement references and a completeness/exception report. Preserve original invoice references for cross-year receipts and credits without reposting historical sales. Separate source invoice dates, payment-event dates and accountant-approved reporting periods.

Group management totals by entity/property/project/category. Keep operating costs, capitalised/project amounts and pending fiscal review distinguishable, including invoiced versus approved deductible VAT. Pending treatment must remain a visible exception and must not silently enter a purported tax-ready subtotal.

Keep the admin fully English. Design export column mappings with Spanish labels where useful to the local accountant, retaining stable machine-readable identifiers and a bilingual column dictionary. Include period/scope, generation timestamp, source counts, checksums and limitations in the package. No 'ready to file' label solely because a ZIP was generated; final treatment and filing remain with the accountant.

## Delivery sequence

1. Stable entity/property/project/category and tax-review fields, preserving existing data.
2. Reviewed cost register and accountant-package completeness/period controls.
3. Import preview, mapping, duplicate resolution and confirmed batch processing using the same model.

Do not publish a partial financial total when a source read is incomplete. All views, exports and mutations require active-admin server checks and database authorization. Test with synthetic data; no real invoices, receipts, tax classifications or customer messages as test fixtures.

## Primary references checked 29 October 2026

- AEAT received-invoice register: supplier tax identity, issue/operation dates, taxable bases, VAT rates/amounts and deductible VAT; correction documents distinguished: https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/libros-registro-iva/libro-registro-facturas-recibidas.html
- AEAT VAT/expense-register FAQ: deduction period can differ from invoice receipt period, deductible VAT and investment-asset flags need separate treatment: https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/preguntas-frecuentes/libro-registro-facturas-recibidas-iva-irpf.html
- AEAT investment-asset register: individual asset/document references, start of use and applicable deduction adjustments: https://sede.agenciatributaria.gob.es/Sede/iva/facturacion-registro/libros-registro-iva/libro-registro-bienes-inversion.html
- AEAT IRPF rental-income guidance distinguishes repairs/conservation from extensions/improvements. This is a reason to preserve separate review fields, NOT a determination that IRPF applies to the user's entities or that the 2024 manual is the current filing specification: https://www3.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2024/c04-rendimientos-capital-inmobiliario/gastos-deducibles/intereses-demas-gastos-financiacion-inmueble.html
