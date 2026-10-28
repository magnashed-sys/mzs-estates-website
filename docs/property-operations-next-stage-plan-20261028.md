# MZS Property Operations — next-stage implementation plan

Prepared 28 October 2026 · Draft planning only · No migrations or Production writes in this change

## Verified current state

- Open draft PR #143, based on main, contains an admin-only Estates cost preview, local CSV reconciliation, a staging-only physical-property/legal-entity attribution form and immutable supplier-cost drafts.
- MZS Staging has four `mzs_ops_` tables: attribution links, their audit, expense drafts and their audit; **all currently empty**. Corresponding Production migrations have not been executed.
- Staging uses the current object/unit register and existing issuing entities and supplier relationships. No secure supplier-document upload, approval, correction, payment register or local-accountant ZIP export yet.
- Current source draft restrictions: status remains `draft`, source document state is `missing`, UPDATE/DELETE rights are absent, and no correction/supersession workflow is available. Entity links are also insert-only; a valid correction flow must exist before real operational use.
- The Catherine WhatsApp history is **not** a set of original supplier invoices or true time punches. Keep original costs, proposed recharge and already issued invoice reference separate; do not automatically post historic rows.

## Implementation sequence

### A. Protected source-document intake (first next implementation PR)

**Goal:** add the original supplier PDF/image to a draft, without granting public file access.

- Use a separate private Storage bucket with strict MIME/size limits, opaque object names, controlled signed URLs and checksum/SHA-256 capture.
- Verify file type using server-side evidence; reject filenames/path traversal, empty files and size-limit bypass. Never put customer/employee names in storage paths.
- Require active admin permission on the exact expense's legal entity for upload/read; enforce both server and Storage policies.
- The uploaded original is immutable. If replaced before approval, preserve evidence/version history and require reason; do not overwrite silently.
- Keep invoice date, service period, received date and paid date separate.
- Download or ZIP export requires explicit access to that entity. Do not expose a user-supplied storage path directly to the browser.
- Real uploaded documents and source chat text must never enter the public GitHub repository.

Acceptance: anonymous/client/partner denied; wrong entity denied; malicious path and oversized/MIME mismatch rejected; approved source original cannot be overwritten; authorised admin can view via temporary URL; all failed uploads leave no orphaned active invoice.

### B. Controlled review, correction and allocation (second PR)

**Goal:** meaningful real workflow from an editable working draft to a verified supplier cost.

Proposed state machine:
`draft -> submitted -> reviewed -> approved` (plus `rejected` / `voided` with reason).
Record partial/full **payments separately**, not as a change of invoice approval status.

- Make draft corrections via authenticated, version-checked operations and append-only audit. Preserve the original submitted/approved snapshot.
- If an entity-property mapping was entered incorrectly, add a **supersede/end-date with evidence** flow, not a silent UPDATE or delete. Prevent an existing approved cost from losing its attribution history.
- Validate approved paying entity at the historical expense date. Entity source names or property `owner_name` are never authoritative legal IDs.
- Require original evidence (or explicitly flagged exceptional evidence requiring second admin review), nonzero totals, net + VAT = gross, 100% of costs allocated to valid property/unit, and duplicate supplier invoice checks within the legal entity.
- Exact amount integer cents, no floating point; preserve source VAT as stated and accountant's legal tax determination separate.
- Prevent concurrent double approval and duplicate export records. Add specific, actionable error messages.
- Separate internal supplier **costs** from client **recharge** and actual staff time: they may have different amounts, VAT rates, counterparties and dates.
- No automatic sales invoice, email or bank transfer when approving a cost.

Acceptance: error and correction workflow, two admins editing stale drafts, multiple units, entity mismatch, duplicate supplier invoice, no source, rejected/voided with immutable audit, no unintended sales invoice or email.

### C. Per-entity export for local accountants (can prototype in parallel)

**Goal:** one download per entity and fiscal period; no direct bookkeeping connector.

Export ZIP contents proposed:
- `README.txt` (entity, period, generated timestamp, scope and cut-off semantics);
- `sales-invoices.csv`, `purchase-invoices.csv`, `receipts-payments.csv`, `property-allocations.csv`, `billable-work.csv`, `exceptions.csv`;
- originals and issued PDF documents in `documents/`;
- `manifest.json` with source IDs, document hashes, row counts and per-file checksums.

Controls:
- Fail closed on incomplete paginated sources; show "incomplete" rather than misleading totals.
- No cross-entity rows or attachments; do not treat scheduled amounts as received cash.
- Invoice / tax / service / entry / payment dates remain distinct.
- CSV escape formulas and protect UTF-8/Excel compatibility; add deterministic sort and audit-friendly export ID.
- For changed data after an earlier export, create a second version plus differences report rather than rewriting the earlier download.
- Accountant can inspect a workbook, but MZS does not become a general ledger or VAT filing tool.

Acceptance: mixed company and private owner, 2026-2027 boundary, missing document, payment reversal, opening balances clearly marked unknown, document hash integrity, duplicate values, empty period and large-volume pagination.

### D. Mobile staff register (separate, after permissions review)

- Staff and contractor identities with property-scoped permissions. Do **not** reuse `mzs_property_partners` owner-stay grants.
- Form: actual work date/time and duration, property/unit, task, optional photos/materials, submit/review/correct; offline drafts only if explicitly designed.
- Billable minutes calculated from effective customer rule; actual time remains unchanged.
- Catherine pilot: 45-minute actual visit -> 60 chargeable minutes; two 30-minute visits -> 120 chargeable minutes (assuming minimum one hour per visit); employee/contractor pay is distinct from client billing amount.
- Only manager/admin sees commercial rates and client billing. Staff cannot list loans, bank details, cross-property tickets or other staff history.

### E. Maintenance and work orders (separate)

- Property/unit-scoped reporting, photos, priorities, technician allocation, visit planning, quotes, materials, work logs, verification and reopening.
- Link to expense drafts and staff logs *by reference*, never create duplicate costs.
- Prevent creation of customer invoice until billable status and correct debtor/issuer are explicitly approved.
- Add future preventative maintenance calendar and periodic contracts.

## Release boundaries and safety checks

- Continue on separate feature PRs and Stage first, never automatically promote existing #143 to Production.
- **No historical Catherine or Zorgbalans invoice 7113 import/issuance** without independent source review and duplicate protection.
- Group owner must approve legal entity ↔ property associations before using real cost records.
- No real invoice send, VAT filing or external accountant export dispatch from test stages.
- Existing financial and booking records remain untouched; additions must be compatible with the production branch at the time of release.
- Require local CI, PostgreSQL/RLS tests (staff, client, anonymous, inactive, wrong entity), protected-doc access tests, authenticated browser acceptance, Vercel READY deployment and owner approval at each publication boundary.
- Review prior RLS/security advisor warnings separately; a preview branch being READY is not evidence of completed authenticated end-to-end acceptance.

## Practical next decision points (only when entering real data)

1. For each registered property, which existing legal entity is its owner, payer and manager, on which date and based on what evidence?
2. Which original supplier invoices are available and which historical chat expenses are only informational?
3. For Catherine, is work invoiced as an external supplier/contractor or entered by her via a staff account? Support both without assuming employment.
4. What recharge tariff/rule and VAT treatment are confirmed per debtor/property? Treat invoice 7113 as previously prepared; confirm its actual issuance and payment status before any import, and never generate a duplicate.
5. Do local accountants need optional country-specific labels/columns beyond the general ZIP+CSV/PDF export?

Suggested immediate next branch: **protected supplier source-document storage + draft correction workflow**, without automatic approvals; accountant export contract fixtures can be built in parallel.
