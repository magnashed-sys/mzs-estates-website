# Annual administration acceptance and import preparation

The owner requested the annual administration practical acceptance checks followed by preparation for controlled bulk import. This change adds a read-only supplier-cost CSV preflight inside each entity/year administration, in English and Spanish.

## Scope

- Group-admin authentication and existing RLS apply before loading the selected year, issuer, supplier/property references and the complete supplier-cost duplicate register for that issuer across all years. Source loading fails rather than checking against a partial register.
- CSV stays in browser memory. No upload endpoint, persistence, server action, invoice issuance, payment registration, email, schema migration or external processing is added.
- Explicit delimiter, decimal separator and date format; manual column matching; 2 MiB / 1,000 data rows / 40 columns / 4,000 characters per cell limits. Malformed quotes, headers, row widths, invalid encoding and unsupported amounts are rejected rather than coerced.
- Entity and year checks; unique supplier references; explicit EUR; original net/VAT/gross reconciliation; known category codes; duplicate invoice references both within the file (all occurrences) and against the issuer's supplier-cost register across years. No VAT recovery or paid status inferred.
- Property costs remain blocked until dated payer/allocation validation is implemented. Negative credits and zero-value costs require a separate workflow. Historical invoices, sales and document archives are not claimed as covered by this duplicate check.
- Preview is not approval. No final-import button or posting API exists. Data may have changed after page load; future posting must revalidate server-side transactionally.

## Evidence

- 418/418 automated tests pass, including existing PostgreSQL/PGlite scope, RLS, audit and original-amount checks, plus nine CSV preflight tests.
- Next.js production build and TypeScript pass with synthetic local Supabase configuration. Existing unrelated CSS compatibility warnings remain.
- Real Next.js HTTP/server-action integration passes against an isolated synthetic API: EN/ES year and import screens; save/reopen settings; stale update denial; create project; create cost; duplicate denial; project-linked review; filters; ZIP download; unavailable source refusal; client denial and anonymous redirect. This is not graphical browser acceptance or live Supabase browser acceptance.
- Live browser reached the login screen: no authenticated admin session available. No production records were changed.
- Managed local graphical preview could not start: the preview daemon supplies Vite flags (`--host`, `--strictPort`) which the existing Next.js dev command rejects. Temporary synthetic component fixture was removed; no authentication bypass or test route is committed.

## Remaining acceptance and implementation

1. Authenticated staging browser acceptance on desktop/mobile, including actual CSV file selection, column matching and language changes.
2. Real sample-file mapping with the owner; resolve supplier, entity, property and project references without silently creating relationships.
3. Transactional server-side import, provenance/batch audit, idempotency, dated payer validation and final confirmation, separately tested before enabling any writes.
4. Reconcile historical-source duplicates and cancellation/correction handling before calling the import comprehensive.

Prepared on a separate branch; production remains unchanged.
