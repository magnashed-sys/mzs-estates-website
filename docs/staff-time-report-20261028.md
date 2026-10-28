# Staff time report

Admins can now review worked minutes over an inclusive period of at most 366 days at `/admin/workspaces/estates/time-report`. Property and worker filters apply to every total, grouping and CSV row. The default period is the current month through today in Europe/Madrid. The daily action center and staff workspace link to this report.

The report preserves original minutes alongside the latest accepted correction. Its four exclusive groups are approved, awaiting review, open correction and returned. An open correction takes precedence over an earlier approval: current recorded minutes remain visible but are excluded from the approved total. Proposed minutes remain in the dossier. Times use hours:minutes, without rounding, wages, rates, billing amounts or cashflow changes.

One active-admin-only, security-invoker STABLE RPC reads an RLS-preserving statement snapshot of current visits plus minimal ID/name directories. A maximum of 10,000 visits and 10,000 entries per directory fails explicitly rather than silently truncating totals. Missing or contradictory source data fails the whole report. Detail rows paginate by 25; totals cover the entire selection. Dossier links retain the report filters and page.

CSV downloads fetch a new snapshot and include its timestamp, selection, source IDs, original/current/approved minutes, review state and descriptions. A pending correction has zero approved minutes even when the previous decision was approved. Existing spreadsheet-safe CSV escaping, private/no-store headers, admin authentication and a 4 MiB output limit apply. Concurrent reviews may make a download differ from an earlier screen, as explained beside the link.

## Validation and rollout

- Unit and route tests cover real dates, Madrid boundaries, inclusive periods, exact aggregations, duplicate names, conflicting/missing data, source provenance, formula escaping, access order, all-or-nothing export limits, 61-row pagination and safe dossier return links.
- Disposable PostgreSQL tests execute real migrations and verify roles, RLS, active-admin checks, original/corrected minutes, pending/rejected reviews, filters, 366-day boundaries and the 10,000-visit limit.
- `tests/db/staff-time-report-rollback.sql` validates the authenticated workflow with transaction-local synthetic records on staging and production. It must run inside BEGIN after the migration and ends with ROLLBACK.
- Rollout adds only `mzs_ops_staff_time_report(date,date,uuid,uuid)` and execute privileges for authenticated callers; the function independently requires an active admin. No staff access grants or operational/financial records persist from tests.
- Run the full test suite, typecheck and build; require CI and a staging-backed preview for the exact release commit. Apply the reviewed additive function migration before publishing the application. Update the production pilot release SHA to the merged commit and create a fresh production build. Verify READY, exact commit, custom-domain alias, public/login/private route behavior, database fingerprints and security-advisor deltas.
- The previous production deployment `dpl_FVDXQENUkdBZRrR5o34pr2Uwzxh5` (commit `352463b803cd4d03d444600001d779550a72b80e`) is the application rollback target. The read-only RPC can remain unused after rollback. Keep the pilot release SHA aligned with the restored commit.
- An authenticated visual browser test requires the user's own admin session; automated role/RLS, route and database tests do not substitute for that acceptance check.
