# MZS Group Admin Backend — Navigation & Operations Review
Date: 26 October 2026 · Staging change proposal (PR pending acceptance)

## Verified starting position
- `/admin` contains a client-rendered legacy dashboard (approximately 50 KB of source) with combined tabs for Group, Estates, Capital, Relationships and Bookings.
- The tab labelled **Bookings** previously opened the older request/calendar management surface. The secured unified reservation register lived separately at `/admin/unified-bookings`, under the **SYSTEM** navigation group.
- Unified Bookings already reads booked stays, unavailable periods, owner-stay requests, original PDF provenance, booking receipts and invoice drafts. Existing approval, cancellation and owner-stay workflows use separate guarded backend functions.
- Existing group department routes and distinct Estates/Capital scopes are deliberately retained. This change does not alter roles, auth, RLS, booking status transitions or invoice numbering.

## Implemented in this Staging branch
1. **Bookings becomes the central administration section** adjacent to Group, Estates, Capital, Relationships and System. Main action `All Bookings` opens the secured canonical `/admin/bookings`.
2. **No breaking links:** the existing `/admin/unified-bookings` and `/admin/unified-bookings/[id]` implementations remain; their secured implementation is reused at the new canonical `/admin/bookings` and `/admin/bookings/[id]`.
3. The old `/admin?tab=bookings` stays operational but is clearly labelled **Requests & Calendar**, and is directly reachable from the Bookings group. Owner stays remain a specialist link, not mixed into rental income.
4. The Group dashboard gains a **Daily operations** workspace with links to all bookings, incoming requests & calendar, and owner stays.
5. The secure Bookings register gains clearer operation names, quick links to requests, owners, contracts & invoices and properties, with visibly qualified loaded-count KPIs.
6. Edited imported reservation **guest names and billing recipients** are shown in the register from the current audited override, not the superseded original confirmation, while original source references remain visible.
7. The next-arrivals summary now links straight to the individual secured booking dossier.
8. Receipt/correction/invoice action redirects use `/admin/bookings/[id]`; the existing RPCs remain unchanged.
9. Current/past arrival comparison uses the Madrid date rather than a UTC day boundary.

## Follow-up optimization recommendations (NOT implemented in this PR)
- **Scale & historical completeness:** replace the current `limit(250)` per booking source with server-side paginated/period-scoped queries and counts from the database. Until then filters search only loaded rows, and the UI discloses that bound.
- **Admin application split:** the legacy Admin root currently loads many relationship, company and project records before rendering, even when navigating immediately to bookings. Separate route modules and scoped loaders reduce response time and component complexity.
- **Consistent actions:** gradually move approval and calendar controls into Bookings tabs/route; preserve audited backend RPCs and prevent duplicate action pathways until full integration is acceptance-tested.
- **Billing reconciliation:** integrate historical booking receipts, invoice drafts and issuing entity carefully; existing receipt differences cannot be assumed to be unpaid bank transactions.
- **Role-scoped navigation:** when department-specific admins are enabled, generate module links from server-authorized scopes, not client-side role switches.
- **Operational insight:** add explicit bank reconciliation and invoice status summaries once those transaction sources are trustworthy. Never infer payment from booking confirmation.

## Acceptance checklist
- Open `/admin`. See Group, Bookings, Estates, Capital, Relationships, System in the top navigation; click **All Bookings**.
- In `/admin/bookings`, filter year (for example 2024 or 2027) and search guest/company/source reference; open a dossier. The URL should use `/admin/bookings/[id]`.
- Confirm modified historical guest/invoice recipient records use latest audited correction, preserving the original PDF/number.
- Return to **Requests & Calendar** and test the existing requests/cancellations views; visit Owner stays and Contracts.
- Verify overview **Upcoming arrivals** directs to the booking dossier. The legacy `/admin/unified-bookings` deep link must still resolve.
- No access to booking data when logged out or without the relevant administrator authorization.
- Production not touched until owner approves the Staging candidate.
