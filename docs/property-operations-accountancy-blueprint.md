# Property Operations & Accountancy — architecture blueprint

**Status:** preparation / draft for owner review, 28 October 2026. **No database migration, account change, invoice issue, email, or Production release is authorised by this document.**

## 1. Product boundary

Build an operational finance and property-management layer inside the existing MZS Group admin, not a second general ledger. The Group keeps source invoices, supplier expenses, object/unit allocations, recorded employee work, maintenance cases, controlled customer recharges, reconciliation status, and financial reporting. **Local accountants remain the accounting/tax system of record** and receive a documented per-legal-entity export. No external accounting APIs, statutory filings, wage payroll, automatic tax decisions, or general ledger posting are required.

The system must display separately: (a) scheduled or estimated amounts, (b) approved expenses or issued invoices, and (c) actual payments. Historical invoices and balances are never inferred from unverified chat text.

## 2. Existing platform integration — read-only review

Reviewed the GitHub main branch and Supabase Production schema. Reuse:

- `mzs_estate_properties` and `mzs_estate_units` for physical holdings and units (currently 2 properties / 22 units registered); `projects` remains a separate private marketing/project access model. Some holiday rentals will need explicit project-to-physical-property mapping, not an automatic title match.
- `mzs_lease_issuers` for existing company and private-person legal billing entities (currently 3 registered), including invoice prefixes and immutable issuer snapshots.
- `mzs_lease_relationships` for suppliers/customers when appropriate, central Relationships/Companies, existing lease contracts, lease invoices and rental payment events.
- `mzs_booking_invoices` and `mzs_booking_receipts` for guest-stay financial flows; `mzs_capital_deals.entity_id` for expressly assigned loan reporting.
- `mzs_property_partners` is linked to marketing project access and owner stays. **It is not a staff-management permission system** and must not be reused to grant employees broad customer or finance access.
- Existing `requireEstateAdmin()` and cross-environment checks for administrator pages; new staff routes need independent least-privilege guards and row policies.
- Existing locked invoice issue/delivery flows; new cost or hours approval must never silently issue an invoice or send email.

Historical data must never be matched to an entity by name. Property `owner_name` is descriptive, **not verified legal ownership**. Unassigned entries remain visible as requiring attribution and are excluded from final accountant-ready exports until reviewed.

## 3. Functional areas

### A. Legal entity and property allocation

Each expense belongs to one **verified legal paying/receiving entity**, with one original supplier invoice and one-or-more allocation rows. An allocation may apply to a whole property, one unit, or several units through explicit percentages or measured consumption. Allocate cents exactly once; shares must total 100%. Separate legal owner, operational manager, paying entity, supplier, customer and invoice issuer, even when their names coincide.

A cost can be shared between entities only by an explicit inter-entity transfer/recharge workflow with its own legal documents, not by assigning one supplier invoice to two owners. Private-person invoices must not acquire MZS branding; issuer identity, invoice numbering and tax settings are entity-specific.

### B. Property operating costs

Initial categories: gas, electricity, water, cleaning, internet/telecom, waste, insurance, municipal charges, repairs, planned maintenance, utilities reconciliations, subscriptions, management fees, materials, and other.

Fields: category, legal entity, source document hash, supplier, source invoice number, invoice date, service period, payment due date, net, input VAT as stated on invoice, gross, currency, object/unit allocations, recharging eligibility, optional project/work order, notes, approval actor/time and payment records. Keep actual invoice date, service date, entry date and payment date separate.

Status flow: draft -> submitted -> reviewed/approved -> partially/fully paid (or rejected/voided with audit). The approval step does not determine local deductibility. Prevent duplicate supplier invoice numbers *within the same entity and supplier* and flag matching document hashes; an override requires an auditable reason. Never silently overwrite original PDFs.

Recurring contracts (utility suppliers etc.) may generate upcoming reminders or expected costs, but not fabricated issued invoices.

### C. Staff portal and work logs

Introduce a **Staff / Operations Employee** capability, separate from clients, partners and capital administrators. A person's assignment is explicitly scoped to one-or-more physical properties, optionally units, and actions (submit hours, report maintenance, view assigned tickets). A staff role does not imply visibility of tenant contact data, invoices, rates, bank accounts or any other property. Existing account-role enum and login/registration flows require a security review before rollout.

Each actual visit stores service date/time, timezone, actual minutes, property/unit, category, work order (optional), employee, description, attachments, and an approval record. Approval preserves the original record; corrections create auditable revisions.

Customer charge calculation is **separate**: reviewed billing rule snapshot, chargeable minutes, agreed rate and explicit bill-to customer/issuer. For the Zorgbalans pilot, actual visits round **up per visit** to a 60-minute increment with minimum 60 minutes. Example: 45 minutes -> 60; 90 -> 120. This must NOT transform an aggregate weekly amount into assumed individual visits. €25/hour from the previous example remains a *pilot setting pending review*, not a globally applicable rate.

### D. Maintenance and work orders

Any authorised reporter can create a maintenance ticket on a physical property and optional unit, with title, description, priority, category, photo and safe contact channel. No tenant/client information should be exposed to staff by default.

Status: reported -> triaged -> assigned -> in progress -> awaiting parts/quote -> resolved -> verified/closed (with cancelled/reopened audit paths). Work orders link assigned internal staff or vetted external supplier, estimated/approved budgets, actual time, material expense and completion evidence. Prevent cost double counting: original supplier bill is one expense, used materials/time are linked operational sources, customer recharge is a separate reviewed output.

Add planned/preventive maintenance scheduling later, with object-specific recurring tasks and expiration alerts.

### E. Recharge and invoicing

Explicit eligibility: non-billable / billable / unclear, with a review trail. Only approved, not previously invoiced **charge items** may be assigned to a draft invoice. Tax treatment is selected and reviewed per issuer, country, line and service; **never infer 21% or exemptions** from the property name or earlier invoice. Generated customer invoice is immutable when issued; corrections require a credit/corrective invoice rather than editing the original. Reuse existing issuer sequencing and protected delivery logic after compatibility review; do not create a second competing number counter.

### F. Local-accountant export (only external accountant hand-off)

Authorised administrator chooses: entity, calendar/fiscal period, currency and export scope. Download a ZIP with a clear README/manifest, source documents and separately named UTF-8 CSVs (or XLSX review workbook): issued sales invoices, purchase invoices, payments/refunds, cost allocations, billable employee hours, property summary, maintenance-linked costs, and unmatched/exception items. Amounts net/VAT/gross; include original date, service period, payment date, currency, legal issuer, partner and source identifiers. Do not equate invoice date, tax point, service period, payment date and allocation date.

Export must be complete (paginate/fail closed), deterministic, idempotent and ledger-safe; use source SHA-256 where available and a downloadable snapshot/manifest with export ID, timestamp and operator. Protect against CSV formula injection and never expose a cross-entity file. Re-export changes get a new version and delta report. **Export is not a posted accounting journal or a tax return.** Any accountant-specific column mapping is a configurable profile and must be confirmed locally.

## 4. Proposed model for a future additive migration (NOT YET APPLIED)

1. `mzs_ops_property_entity_links`: verified physical property <-> legal entity and relationship type + validity dates (do not rewrite owner_name).
2. `mzs_ops_supplier_expenses`: original supplier invoice and immutable source metadata, owning entity, supplier, currency, amounts, review state, timestamps.
3. `mzs_ops_expense_allocations`: expense -> property/unit share, percentage, amount in cents, prevents duplicate totals and preserves audit.
4. `mzs_ops_staff_assignments`: active user, property, permission set and revoked-at, separately reviewed from group/partner scopes.
5. `mzs_ops_time_entries`: measured visit data, submit/review/reversal, parent assignment, optional work order.
6. `mzs_ops_maintenance_tickets` and `mzs_ops_work_orders`: reporter, property, priority, state, images, tasks, supplier, budgets.
7. `mzs_ops_charge_items`: approved customer recharge records with single source link, immutable bill-to, issuer and tax/rate snapshot; unique source keys prevent repeat invoicing.
8. `mzs_ops_export_batches`: entity-period export snapshot + integrity manifest/audit; source documents in a private storage bucket.
9. `mzs_ops_audit`: append-only actor, time, old/new revisions, approvals and error/reversal reason.

All foreign keys explicit. Never delete an issued/approved financial record via UI; use correction/void/reversal workflows. No financial data or personally identifying test data in GitHub.

## 5. Security, jurisdiction, data quality

- Strict per-entity and per-property access; staff only their assignments, Group Admin broad control, Property Manager scoped operational review, accountant receives ZIP but requires no login.
- RLS on every exposed table, deny direct protected invoice/approval writes, block anon access, constrain privileged RPCs to non-exposed schema with explicit active user and permission verification. Review every SECURITY DEFINER grant, no trust in editable user metadata.
- Documents private, immutable versions, short-lived authorised download links, storage hash validation, no public URLs, encrypted connections.
- Outgoing invoice delivery, customer access and monetary movements always require explicit admin approval. Preview/Staging never uses Production credentials or SMTP delivery.
- Retention policy configurable by legal entity and country, with legal holds; for Netherlands distinguish the ordinary 7-year retention and real-property-related 10-year rule, confirm each category with local accountant. Store original electronic invoices and supporting records.
- Currency and local tax settings configured per issuer, never hard-coded globally. Initial EUR-only pilot is acceptable, but schemas should permit additional ISO currencies later if needed.

## 6. Acceptance stories and roll-out

**Phase 0 / this draft:** read-only inventory; define data boundaries; provide tested pure functions for per-visit rounding, exact cents allocation, explicit VAT calculations and safe accountant CSV. No new tables or visible UI.

**Phase 1 / Staging only:** verified property-entity mapping, supplier invoice upload/approval, cost allocation, cost list and property operating-cost dashboard, accountant export with deterministic manifest. Test EUR and VAT options, multiunit split, supplier duplicates, missing legal entity, document permissions and mixed-period flows.

**Phase 2 / Staging only:** independent staff capability with user invites, per-property membership, mobile time entry, manager approval, billing rules. Test 30/60/90 min visits, multi-property staff scoping, revocation, attempts to read bank/tenant/loan data.

**Phase 3 / Staging only:** maintenance tickets, work orders, photos, supplies and recurring jobs, linked to costs and hours. Test closure/reopen and external contractor restrictions.

**Phase 4 / Staging only:** approved charge items -> reviewed sales invoice draft -> existing protected invoice issue/delivery; bank payment tracking and re-export with delta manifest. All jurisdictional tax rules and actual accountant files subject to local approval.

**Pilot:** Catherine cleaning visits and Zorgbalans (Kennemerlaan), then both IJmuiden multi-tenant buildings, then Spanish holiday properties. Do not import or re-issue historical invoice 7113 automatically; it is evidence for design only.

**Release gate:** a new feature is never promoted without exact-source CI, real Staging security tests, admin + staff permission smoke tests, export/PDF review, explicit owner acceptance and a reversible application release plan. Production data remains untouched in preparation.
