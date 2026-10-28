# Historical cost statements and externally issued invoices

The admin historical register at `/admin/workspaces/estates/history` persists imported weekly cost statements with their original amounts, source locations, message references and checks. Filters select reporting year and worker. Totals cover the complete selection; detail pages contain 25 rows. The original CSV and invoice remain linked through their Library identities. Private CSV exports preserve provenance and explicitly leave actual minutes unknown.

These costs are not reconstructed staff visits, purchase invoices, payments or VAT deductions. They may include supplies, private expenses and other people's work. Their week periods do not establish exact visit dates. Existing daily time reports therefore continue to show only recorded visits; they link to the historical register for source statements.

An externally issued invoice records a source-confirmed issuer, customer, property, number, dates, amounts, VAT and charged hours. It links the exact historical source rows. It does not allocate a new number, send email or create receipts. Payment and delivery evidence remain `not_recorded`. The annual accountants-export includes these invoices once, with known source VAT, alongside existing rental and booking invoices. Receipts remain a separate source.

## Data and access controls

- Three new tables use active-admin SELECT policies with RLS. No application role, including service_role, has write permission. Controlled imports run through the owner's administrative database connection and record the authorization reference and `controlled_import` provenance, without impersonating a staff member.
- Batch, source-row and external-invoice records are immutable. Unique source identity, canonical extracted-CSV hash and per-worker row references prevent repeat imports. The hash basis is explicitly UTF-8 extracted CSV with LF line endings; it is not represented as the original uploaded file's byte hash.
- Deferred constraints require all expected rows and original source costs to reconcile atomically. Invoice hours and amounts must equal their linked rows. Cross-batch invoice links, partial imports, altered totals and unsupported VAT are rejected.
- A shared issuer-row lock guards external invoice number collisions against both existing invoice tables, and guards future platform invoices against registered external numbers. Existing issuer prefixes, counters and source records are unchanged.
- Admin-only SECURITY INVOKER STABLE functions preserve RLS and one-statement snapshots. Row/directory limits and incomplete-source checks fail the whole report/export rather than silently truncating it.
- Actual private source files and import payloads are not committed. No historical statement is automatically assigned to a property based only on a location label, and no worker access is granted by importing history.

## Verification and release

Run the full tests, typecheck and build. PostgreSQL fixtures exercise deferred reconciliation, immutability, duplicate import/number denial, ordinary invoice inserts, active/inactive admin and staff access, plus exported invoice amounts without invented receipts. Route/model tests cover complete totals, pagination, safe CSV, private access and duplicate/incomplete accountant sources.

Rehearse the additive migration and a synthetic transaction on staging, then a rollback-only import on production using the exact reviewed source. Apply the migration before publishing the application. Require exact-commit CI and a staging-backed READY preview. The authorized production import is a separate atomic, idempotency-guarded data operation after rollout. Verify saved source rows, invoice totals and exported JSON, and compare all monitored legacy table fingerprints and security-advisor changes.

Application rollback target: deployment `dpl_Efwd3SF4ygd6KQUVzKEmbCoFBpHC`, commit `50d0d85d9e61b698837aec1b945073d1c3ed6943`. Keep the production pilot release SHA aligned with any restored release. Existing code will ignore the additive historical tables; imported records remain preserved. The invoice-number protection must remain installed once an external invoice is registered. Do not truncate or restore the database as an application rollback.

An authenticated browser acceptance check still requires the user's own admin session. Automated authorization, model, route and PostgreSQL tests are distinct from that visual check.
