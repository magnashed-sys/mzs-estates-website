# Daily operations action center — 28 October 2026

The owner asked to continue the production optimization after the staff/work-order/photo/report release. This change connects those modules to daily administrative follow-up in both the Group cockpit and Estates workspace.

Eight read-only queues cover overdue planning, new/reopened maintenance, today's scheduled work, missing planning, resolved tickets awaiting closure, pending time corrections, visits awaiting review, and undecided work-order budgets. Review and correction queues do not count the same visit twice. The maintenance queues are mutually exclusive, and exclude closed tickets. Future work with complete planning is intentionally outside these attention queues. A separate budget is a separate action, not an expense or supplier commitment.

The dashboard uses parallel exact HEAD counts. A failed source displays **Niet beschikbaar**, never zero; unrelated parts of the cockpit can render while counts load. `/admin/workspaces/estates/actions` offers all queue records with stable 25-row paging, urgent maintenance first, readable property/person labels and a direct dossier link. Missing reference data fails the affected page rather than presenting an incomplete result. Out-of-range pages recover the last page. Dossiers preserve the selected queue/page for returning after review. Successful visit, correction, maintenance and budget actions invalidate both dashboards and the queue. GET refresh controls fetch the current view without making mutations.

Planning days use Europe/Madrid consistently, including DST. A task scheduled for today is not overdue; missing responsible person puts it in planning. Date and active-admin checks run server-side. The implementation reads existing security-invoker views using the user's session; no service-role client, new API route, schema migration, permission grant, seed, invoice, payment or external message is added. Manual PDF delivery and expense-evidence approval remain deferred.

## Verification

- 309 tests pass. New tests run the actual Supabase JS query builder against an in-memory SQL adapter and fictional fixtures. They cover queue membership and exclusions, urgent ordering, 62-row totals and pagination, stale-page recovery, referenced dossier/property/name lookups, missing counts/source failures, DST, canonical links, authentication-before-query and all affected cache invalidations. These do not claim a live PostgREST end-to-end authenticated session.
- TypeScript and production build passed before the final GET refresh/Suspense presentation adjustments; exact release CI repeats all checks.
- The equivalent queue predicates were queried under an existing active-admin database role on Production inside a transaction ending in ROLLBACK. All eight source views/filters were accepted and returned zero current actions. No records or account attributes were changed.
- No signed-in browser session is available. Verify the exact isolated Staging Preview and production route boundaries; do not claim authenticated visual acceptance. Preserve source-table fingerprints before and after release.

## Release/recovery

Start from main `b83566fa4a02767b6af4c7e4c2f8b078f05e2906`. Require the exact PR head to pass tests/build/security and Vercel Preview before merging. Update only the existing pilot release SHA, then build a fresh production deployment of the merged main SHA. Verify READY, `www.mzsgroup.com` alias, private route redirects and runtime errors. No database rollout is required.

Previous production deployment: `dpl_6iQ5AbgK8bsNWqXktJhdpgQQ4yUY`. Application rollback and restoring its matching pilot release SHA are sufficient; retain all operational history and database schema.
