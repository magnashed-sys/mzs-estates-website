# MZS Property Operations — phase-1 completion audit

Prepared 28 October 2026 — **Staging only / Draft PR #143**
No Production rollout, no Production Catherine account modification or historical invoice import.

## Completed in this final development slice

### 1. Maintenance photo evidence

- Private Supabase bucket `mzs-ops-ticket-photos`; limit 4 MiB; JPEG, PNG, WebP only, with magic-byte checks.
- Up to **three original photos per maintenance ticket**, opaque UUID-only object paths, immutable source-file metadata, server-recorded SHA-256 and size.
- Photo upload via `POST /api/staff/maintenance-photo`: authenticated, same-origin, Preview/Staging only; current ticket reporter with an *active assigned property scope* or Group Administrator. No public file URLs.
- Photo download via `GET /api/staff/maintenance-photo/[id]`, protected by the same database RLS and one-minute signed URLs. An abandoned failed upload can be cleaned up, but any photo already registered as evidence cannot be deleted or silently overwritten.
- Staff portal allows uploading and reviewing only their own ticket evidence; Admin sees protected source links.
- **No OCR, antivirus scanning, automatic face redaction, image metadata scrub or external sharing**. These remain safeguards to consider before Production, particularly for personally identifiable details in pictures.

### 2. Correcting staff time without rewriting source records

- Original `mzs_ops_staff_visits.actual_minutes` remains unchanged forever.
- Staff may submit one correction proposal for **their own, still-unreviewed visit**, reason and corrected whole minutes.
- Active Group Administrator accepts or declines proposal in a separate, append-only decision record. A pending proposal blocks routine time review, eliminating the risk of using the wrong minutes.
- An accepted correction affects the **review snapshot used for calculating candidate billable minutes**. Original actual minutes remain in the audit. No automatic payroll, tax, customer invoice or vendor claim.
- **Already-reviewed visits cannot be corrected by this first workflow.** Such changes require a dedicated supersession/reassessment path; do not alter an approved record in place.

### 3. Internal work order preparation

- For a previously triaged maintenance ticket, Group Administrator creates an internal work-order **draft** linked to an existing supplier, verified legal entity paying the property's costs, scope of work and source quotation reference, with explicit net and VAT budget cents.
- Separate append-only management decision: `authorized_internally` or `declined`, with reason.
- No external vendor acceptance, offer, work execution notification, bank transfer or purchase/customer invoice is sent by this module.
- The budget is **planned/approved internally**, not expenditure, accrued supplier invoice or actual cash. It must never be added to the existing Financial Cockpit as a paid cost.

## Integration boundaries

- Existing rental contracts, bookings, long-term invoices, capital dossiers, client login, owner stays and source documents remain unchanged.
- All staff permission checks use existing active client/partner identities plus explicit *physical-property* grants; not the marketing project table and not Owner Stay partners.
- Catherine's existing Production client account is not copied, privileged or changed. A staff grant can be made to that existing account only after separate, explicitly approved Production release and confirmation of the exact property scope.
- Private photo and operational tables use Row Level Security and do not make the existing full property/tenant/owner registry readable to employees.
- All cashflow, accountant exports and VAT assessment remain separate; candidate billable minutes do not become actual invoices.

## Acceptance checklist before Production

1. [ ] Exact-head GitHub tests, build, typecheck and static security gates green.
2. [ ] PostgreSQL test fixtures: assigned worker can upload evidence for own ticket; unrelated worker and revoked worker cannot read/upload; private bucket; max three immutable images.
3. [ ] Time corrections: own visit only; pending proposal prevents premature review; manager approval changes review candidate, preserves original; duplicate decisions rejected.
4. [ ] Work orders: only after triage, verified entity-payer and supplier; budget/fiscal source preserved, no autonomous external transmission; duplicate decisions rejected.
5. [ ] Staging migrations applied **after** checks; re-run Security Advisor, RLS grants and rollback-only live integration test.
6. [ ] Authenticated mobile and desktop browser acceptance with *designated Staging staff test account* and separately selected Staging administrator.
7. [ ] Security/privacy review of uploaded image contents (face/tenant/PII), retention and attachment lifecycle; supplier commitment workflow if external sending is required.
8. [ ] Resolve already-reviewed time record amendments using supervised supersession before operational live use.
9. [ ] Release/rollback plan for 100+ file Draft PR #143, Staging/Production migration parity, email deliverability, owner acceptance and post-deployment monitoring.

**This is an operational foundation, not a claim of a fully audited accounting system.**
