# Property Operations — staged implementation and acceptance checklist

**Prepared:** 28 October 2026 · **Scope:** design + calculation primitives only · **Database writes:** none · **Production:** unchanged

## Decisions already confirmed

- Local accountants handle statutory accounting and taxes; MZS needs a separate export package for each legal entity (person or company).
- Record operating expenses per physical property/unit: electricity, gas, water, cleaning, internet, repairs, insurance, periodic contracts and other categories.
- Add mobile-first staff time entry with permissions limited to assigned properties.
- Add maintenance issue reporting, assignment, execution, evidence and closeout.
- Allow reviewed, explicitly attributable cost/time charges to be invoiced or marked non-billable.
- Pilot: Catherine / Zorgbalans / Kennemerlaan. The billing rule is **minimum one hour per distinct visit, rounding up to full hours**. Actual worked minutes must remain unchanged. Pilot cost rate €25/hour is a design fixture only; obtain/confirm contractual rate before live use.
- Personal invoices use the selected private-person issuer's own identity and number sequence, not MZS branding.
- No automatic accountant software connector, salary/payroll or VAT return.

## Current state / initial compatibility check

Source reviewed: GitHub main, Production and Staging Supabase schemas. Existing tables include:

- Physical holdings: public.mzs_estate_properties / mzs_estate_units
- Legal issuers: public.mzs_lease_issuers
- Relationship register: public.mzs_lease_relationships
- Rental income: mzs_lease_contracts / mzs_lease_invoices / mzs_lease_payments
- Holiday bookings: rental_bookings / mzs_booking_invoices / mzs_booking_receipts
- Loan reporting: mzs_capital_deals.entity_id
- Existing property partners: project-scoped mzs_property_partners, **not an employee role**

DO NOT insert automatic owner/entity assignments from free-text names or infer physical-property IDs from project titles. Proposed change must be additive, idempotent and independently releasable.

## Phase 1 — object expenses, entity mapping, exports

- [ ] Design final schema and legal-entity/physical-property assignment UI with effective dates and verification evidence.
- [ ] Build purchase-invoice intake: upload original PDF/image, supplier identity/reference, invoice date, period, amounts, currency, approval.
- [ ] Create a private source-document bucket; signed short-lived reads; verify upload MIME/size/hash, prevent tenant/partner access.
- [ ] Add one-to-many property/unit allocation with exact cent preservation; require 100% of the approved total.
- [ ] Reject duplicate supplier invoice identity in a single legal entity; allow reviewed exception with reason.
- [ ] Preserve original invoice independently from later allocation/payment changes.
- [ ] Implement object dashboard separated into forecast/approved/paid/unassigned.
- [ ] Implement export scope authorisation per entity and chosen year/period; ZIP manifest, invoices and CSVs; fail closed on incomplete reads.
- [ ] Test a bill covering all 9 units in object IJmuiden, unit-only bill and a cross-property supplier invoice.
- [ ] Check GBP/AED future fields and country VAT handling without automatically applying tax rules.

## Phase 2 — staff and time

- [ ] Audit client/partner/admin user_role enum and all authorisation branches before adding Staff capabilities.
- [ ] Staff invitation, active state and scoped property assignments with independent server-side checks.
- [ ] Mobile work form with actual start/end, minutes, category, task and attachments.
- [ ] Submit -> review -> approve; immutable history and correction flow.
- [ ] Distinguish employee/contractor cost rate from customer recharge rate; confidential rates only visible to authorised admin.
- [ ] Add per-customer billing-policy snapshot: minimum, increment, rate, VAT treatment and effective dates.
- [ ] Reject unapproved hours and double-use of work entries on two customer invoices.
- [ ] Test employee assigned to property A cannot list property B, invoices, tenants, banking, Capital deals or other staff members.
- [ ] Test revoked staff assignment invalidates access without waiting for stale client-side claims.
- [ ] Test two 30-minute visits billed as 2 hours; a single 60-minute visit as one hour.

## Phase 3 — maintenance cases and work orders

- [ ] Report issue from staff/property manager/authorised partner with location, urgency, description, photo.
- [ ] Assign, accept, update, complete, verify and reopen with persistent audit.
- [ ] Work order linked to property/unit, approved budget, supplier, time entries and original purchases.
- [ ] Support planned checks such as HVAC, pool, fire prevention, and recurring inspections.
- [ ] Prevent duplicate expense from work-order material entries + uploaded supplier invoice.
- [ ] No staff visibility of tenancy/private contact data unless explicitly and narrowly required.

## Phase 4 — billing integration and accountant package

- [ ] Approved recharge item -> existing issuer-aware invoice draft; review before issue and separate approval before send.
- [ ] Include invoice source references to original expense/time and maintenance ticket, without exposing confidential internal notes.
- [ ] No reuse of already billed charge item; correction via credit note/reversal, not alteration of issued invoice.
- [ ] Respect existing monthly contract invoices and guest booking numbering; never invent historical invoices or change existing invoices.
- [ ] Export invoice/credit/payment and cost/time links by entity, date type and business period, with no cross-entity contamination.
- [ ] Provide accountant-ready reconciliation/exception sheet and hash manifest + export revision.
- [ ] Test an export that intentionally contains missing legal owner, missing invoice PDF or uncertain paid date: fail closed with actionable exception report rather than claiming completeness.

## Acceptance / deployment gate

**For each PR:** independent Staging branch + matching Supabase Staging project, code review and CI; migration reviewed with before/after counts and rolled-back transaction test; security advisors and role-denial tests; mobile and desktop acceptance; explicit approval for database migration, then separate explicit approval for Production promotion. Never silently issue actual invoices, import live WhatsApp material, email customers, create staff accounts or change Production from an unapproved preview.

**Financial integrity test matrix:** amount arithmetic in integer cents, legal entity FKs, 100% allocations, duplicate invoices, approvals, partial payments, reversals, cross-year periods, taxes as selected by human, 7/10-year retention policy where applicable, CSV formula injection, document-access revocation, and no export across entities.

## Scope of this initial PR

Pure helpers in lib/property-operations/finance.ts and automated tests cover:
1. Per-visit rounding and hour charges, preserving actual minutes in the future data model.
2. Explicit VAT calculation from reviewed basis points, not automatically determined tax.
3. Deterministic exact-cents splitting of one expense across allocations.
4. CSV escaping, fail-closed row validation and spreadsheet formula-injection prevention.

**Not built in this PR:** tables, staff user role, admin pages, uploads, maintenance tickets, accountant export endpoint, invoice delivery or accounting entries. No database migrations have been applied. Further functional slices need separate review.
