# Monthly cleaning on rental invoices

An administrator can explicitly link the Zorgbalans work area to its active rental contract using `mzs_configure_lease_cleaning(contract_id, starts_on)`. Configure actual identifiers privately; migrations contain no customer records. The existing historical cutoff remains in force.

The normal monthly draft generator adds one `Schoonmaak` line after the rental pricing trigger. Its description lists both office frequencies without allocating hours or amounts by office. Each approved visit is rounded up to whole hours, minimum one, at the existing rate and VAT. No approved visits means no extra charge.

Preparation includes all eligible, previously unbilled visits through the earlier of today and the day before the rental period. It is not limited to a work calendar month: late approvals carry forward. The existing preparation date and rent payment deadline are unchanged. A pending draft can explicitly refresh its hours; checked drafts must first be returned for review. Refresh recalculates the cleaning line and totals while preserving rent/pricing lines.

Visit reservations, source changes, and legacy billing share a transaction lock. A visit can belong to one rental draft only; previously billed standalone visits are excluded. Once configured, the legacy standalone preparation path is blocked at both header and line insertion. Before issue, reserved entries are compared with current approved minutes and pending corrections. Issued source hours and the frozen invoice payload cannot be changed through the application.

The PDF renderer uses that frozen payload, verifies the line and statement totals, and appends `BIJLAGE 1 - URENSTAAT`. The same renderer is used by draft preview, download, and existing invoice mail delivery. Preparation, refresh and preview neither issue nor send an invoice. Review, issue, and sending remain separate existing actions.

Security: settings/reservations are admin-readable with RLS and have no client write grants. Public RPCs are invoker adapters to private helpers that recheck active administrator access. Cron reads authoritative reviews privately without requiring a browser JWT. No staff access to invoice/customer data is added.

Validation: `node --test tests/lease-cleaning-db.test.mjs tests/lease-cleaning-pdf.test.mjs tests/zorgbalans-billing-db.test.mjs tests/lease-database.test.mjs tests/lease-pricing.test.mjs tests/lease-integration.test.mjs` and `npm run typecheck`.
