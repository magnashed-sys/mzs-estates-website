# Admin Backend — Bookings performance and accuracy (Staging)

## Why this change
The old Unified Bookings UI loaded only 250 booking rows and 250 owner stay requests, then filtered the browser's current subset. As history grows, older bookings may be missing from search, year filters and counts.

## Implemented
- Central `/admin/bookings` uses a new server-side search RPC, with exact total and 25/50/100-row pages.
- Search is applied to all available reservations before paging, matching original references, corrected names, guests, contact email, companies and property.
- Filters include check-in year, property, category, status, upcoming/current/past.
- Owner stays included as their own kind, without displaying duplicate linked booking rows or treating complimentary stays as rent.
- Historical billing overrides take precedence over immutable original confirmation metadata.
- A single admin guard at the beginning of the SQL function; search fields and finances are available only to verified active administrators. No public or anonymous `EXECUTE` grant.
- The existing booking dossiers, invoice drafts, receipts, approvals, corrections and cancellation workflows remain unchanged.

## Important boundaries
- Historical data is not modified by this performance improvement.
- This is an admin read-model only; there is no change to payment status, bank reconciliation, notifications or invoicing.
- Server-side filtering is exact for the administrative register. Search is substring/case-insensitive, not fuzzy search.
- The UI reports total matches, filters across the entire register and shows a single page at a time. Years and properties are generated from the full register and not limited to the current page.
- The old `/admin/unified-bookings` URL remains available as a legacy fallback until after acceptance.
- No production database migration or deployment until an explicit acceptance of this separate PR.

## Staging validation
- Function rejects anonymous requests, and reads only as a verified Group Administrator.
- 2024 / 2027 demo data and literal historical-source references are found regardless of current page.
- Group summary and the displayed count agree with the exact filtered dataset.
- Switching page preserves filter query parameters. New search resets to the first page.
- Group/Estates/Bookings navigation continues to reach the canonical route.
- CI: build, typecheck, unit tests and security guardrails.

## Next round after this
Decompose large `app/admin/page.tsx` client shell into independent Group/Estates/Capital/Relationships modules, with scoped loading and route-aware navigation, once the booking-register change is accepted.
