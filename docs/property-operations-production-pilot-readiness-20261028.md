# MZS Group — Production Pilot Readiness Plan
**Date:** 28 October 2026  
**Status:** PREPARATION ONLY — no production database/website/user changes authorized by this plan.  
**Development reference:** Draft PR #143, branch `feature/property-operations-accountancy-foundation-20261028` at source baseline `38580c5ae5a9fe52ccc8191d70c2ab1d115e88c1`.  
**Pilot objective:** test the new Property Operations workflows using existing Production logins, but keep trial records out of real finance, bookings, tax documents, customer correspondence and supplier commitments.

## Verified environment baseline

| Item | Production | Isolated Staging |
| --- | --- | --- |
| Supabase project | `ptrnjzmcehrhbsfxntgw` | `senonkpxdtlhyhrubicg` |
| Project health | Active / healthy | Active / healthy |
| Registered physical properties / units | 2 / 22 | 2 / 22 |
| New `mzs_ops_*` tables | **0** | **19 tables + 2 scoped views** |
| Main branch | Protected at baseline `52f6b9e4bb3ad4044cb272cba70e2920b6a82657` | Draft PR #143 not merged |
| Existing Production identities | Existing active clients/admins incl. Catherine, verified previously | Independent auth population; **Catherine not copied** |
| Code environment restrictions | Staff, expense, export and pilot routes currently require `VERCEL_ENV=preview` and/or exact Staging URL | Enabled only on isolated Preview |

**Important:** a Vercel READY deployment and successful PostgreSQL tests do *not* certify actual signed-in browser acceptance. The source PR spans 113 files; merging the whole PR in one step is inappropriate for a first user pilot.

## Pilot scope (proposed, not yet enabled)

1. Use **one existing named Production client account**, such as Catherine *after confirming her duties and property access*, plus Group Admin. Do **not** create a duplicate login, promote a client to admin, expose credentials, or copy Production auth.users to Staging.
2. Grant access to **one explicitly confirmed physical property**. Although the Production register has two IJmuiden properties, do not infer that either is the property Catherine manages. Villa La Nucia is a separate rental project and must not be silently mapped to an IJmuiden object.
3. Enable only **Staff & Maintenance** as the first Production pilot: visible assigned property/unit directory, actual visit, correction request, manager review, maintenance issue and private synthetic photo, optional *internal* work order.
4. **Do not pilot financial posting initially.** Keep supplier invoice issuing, customer recharge, actual payments, emails, Capital, booking/owner-stay changes, external work-order dispatch, creditor payment and statutory accountant export disabled. The existing Production application and financial cockpit remain authoritative.
5. For initial real-world use, use **synthetic named test visits and a synthetic, privacy-safe photo**, not a real customer invoice, sensitive property image, employee pay or WhatsApp archive.

## Before any Production switch: required technical changes

### A. Production-safe server gates (default OFF)

Introduce a central server-only gate (e.g. `MZS_OPS_PRODUCTION_PILOT_ENABLED=false`) that validates:
- `VERCEL_ENV=production` **and** the known Production Supabase host only for Production pilot mode.
- The pilot is expressly enabled, the user is authenticated and active, and their stable profile ID is on a **server-side approved allowlist**, not supplied by the browser.
- Staff access also requires the existing database-enforced per-property `grant` event and correct client/partner role. Revoke immediately removes access.
- All write actions, API routes, downloads and list pages perform the same gate on the server. Client-side navigation flags are presentation only, never security.
- No browser-exposed service-role key, no cross-Supabase token validation, and no Production URL paired with a Staging database.
- Feature shutdown returns a controlled disabled/not-found response and does **not** break existing client login or Group Admin.

**Current status: NOT IMPLEMENTED.** Do **not** simply replace Staging URLs with Production URLs or turn an existing Vercel Preview deployment into Production.

### B. Explicit separation of pilot data from real administration

The existing new tables use immutable audit/history and **do not have a universal pilot marker**. Therefore a Production pilot cannot safely insert disposable test records directly into the current design.

Before switching on, choose and implement one:
- **Preferred:** a server-enforced `pilot_run_id` / `record_origin = 'pilot'` on the subset of operational visit/ticket/attachment records used for the trial, inherited in every related review/event/order row, immutable by staff and excluded by default from all financial/accountant exports and operational totals; pilot data never enters legacy tables.
- Alternatively, a physically separate pilot schema/database with Production identity authorization carefully designed and independently tested; do not share tokens or service keys across environments.

Add a visible **PILOT / GEEN ECHTE FACTURATIE** label in the UI, source-based audit export, and an explicit retention/closure method. Never rely on the words "TEST" in a free-text description to identify or exclude test costs. Because evidence is append-only, a safe finish means audited void/archival/exclusion, **not** silent deletion.

**Current status: NOT IMPLEMENTED; must block Production pilot until complete.**

### C. Release as small, auditable increments

Split or selectively stage the large draft PR into **separate, reviewable production release slices**:
1. **Schema/RLS only, default OFF** — review and adapt the 12 Staging-only migrations listed below for Production-specific dependencies; verify PostgreSQL versions, permissions, storage configuration and RLS. No test grants.
2. **Staff pilot UI + routes only, still OFF** — link via server flag, verify limited client and Group Admin flows, mobile & desktop.
3. **Private photo and internal work-order subset** — after content privacy, retention and image metadata policy; no external orders.
4. **Financial/admin export optional later** — only after legal entity mappings, VAT, original invoices, approvals, bank-event versus accrual tests and accountant acceptance.

Never deploy the large draft PR wholesale to Production merely to obtain working logins.

### D. Migrations in verified dependency order

Staging operational migrations in GitHub source order:

```
20261028115000_mzs_ops_entity_links_staging.sql
20261028123000_mzs_ops_expense_drafts_staging.sql
20261028134000_mzs_ops_evidence_review_staging.sql
20261028143000_mzs_ops_correction_requests_staging.sql
20261028155000_mzs_ops_correction_decisions_staging.sql
20261028163000_mzs_ops_expense_replacements_staging.sql
20261028171000_mzs_ops_staff_maintenance_staging.sql
20261028173000_mzs_ops_secure_staff_directory_staging.sql
20261028181000_mzs_ops_visit_reviews_maintenance_events_staging.sql
20261028190000_mzs_ops_staff_corrections_internal_orders_staging.sql
20261028191500_mzs_ops_ticket_photo_evidence_staging.sql
20261028194500_mzs_ops_fk_indexes_staging.sql
```

These are **Staging source files, not a reviewed Production migration set**. Production has no `mzs_ops_*` tables. Resolve schema dependencies and production role/owner permissions before porting. Review migration history for other changes that diverged between Staging and Production.

### E. Backup, release safety and rollback

- Verify current successful Production backup, restore availability and recovery point **before** adding schema. A backup not tested for restoration is not a validated rollback plan.
- Snapshot actual Production schema/migration inventory and the existing protected `main` commit; preserve baseline CI and Vercel deployment ID.
- Apply additive schema only in an approved, scheduled, monitored release window with no real invoice email send; gate remains OFF.
- Run RLS attack tests with admin, assigned staff, unassigned client, disabled account, another property, and revoked grant.
- Enable **only** explicitly approved test account(s)/property once no real financial writes are possible.
- **Stop switch:** disable the server-side pilot flag, revoke the pilot property grant in the append-only access log, confirm sessions can no longer read/write pilot rows, and retain immutable audit. Do not drop live tables as an emergency rollback.
- Always compare pre- and post-release records for bookings, rental contracts, issued invoices, Capital and owner stays; they must remain unchanged.

### F. Photo, compliance and finance gates

- Private ticket images still lack EXIF/location stripping, image/metadata privacy review, malware/content screening and an agreed retention period. Restrict any first pilot to a **privacy-safe synthetic image**, not identifiable tenants, guests or private papers.
- Already-approved erroneous staff time cannot yet be superseded by a reviewed correction without a separate authorized revision workflow. Explicitly block that use case or implement it before ongoing real use.
- Manager-approved billable minutes are **candidates only**, not confirmed income or invoices.
- Internal work-order budgets are **not** supplier commitments, purchase invoices or cash paid.
- Accountancy ZIPs are **partial rehearsals**, not tax returns, complete invoicing, or balanced ledger extracts. Hold them outside the first Production pilot.

## Guided acceptance sequence

1. **Preparation pass:** backups/restoration confirmed; exact release commits/migrations recorded; flag OFF; no production pilot rows.
2. **Administrator login:** existing Production admin sees baseline unaffected, optionally the pilot only when authorized; assign one verified client to one verified physical property, log consent.
3. **Employee login:** existing client signs in, sees one property/assigned units only, no other staff, financial/private capital/owner-stay content.
4. **Trial actual time:** submit separate synthetic 45-minute visit; request correction to 30 minutes; manager approves; any 60-minute billing candidate remains **not invoiced**.
5. **Trial ticket:** add a synthetic maintenance report, upload one non-sensitive photo, manager triages, prepares and internally approves a budget without sending externally.
6. **Isolation checks:** unrelated client and revoked staff cannot view attachments, history or create entries. Wrong-property and wrong-unit writes denied.
7. **Audit and exit:** count pilot rows and ensure no financial/accountant/export impact. Preserve or archive pilot evidence per agreed retention; flag OFF or explicitly approve next phase.

## Measurable GO / NO-GO

- **NO-GO now:** Production migration set, server pilot gates and test-data isolation are still missing. Authenticated end-to-end user acceptance remains unverified.
- **GO for narrow Production pilot only when:** all default-OFF server gates, staging-tested migrations, backup/restore verification, pilot record isolation, RLS checks, no external side effects and a documented stop switch are proven, then the owner explicitly authorizes the specific pilot.
- **GO for general Production launch only after separate acceptance:** account and property assignment, mobile usability, picture privacy policy, already-approved time correction, accountant/finance completeness and post-deploy monitoring.

## References

- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase RLS and API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Draft PR #143](https://github.com/magnashed-sys/mzs-estates-website/pull/143)
