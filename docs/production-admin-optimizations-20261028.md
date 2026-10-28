# Production administration optimization — 28 October 2026

The owner requested further Production optimizations and postponed manual supplier-PDF delivery. This release starts from Production `d71c08fead758ccf3495e1d4c79deb8a79fd06c0`; it does not merge the Staging PDF/scanner/retention stack (#154–157) or the broad Property Operations draft (#143).

## Result

- Cost concepts previously made the entire admin page unavailable after 200 records. The register now uses server-side filters (reference/description, property, payer, supplier and date), stable 25-row pagination and exact page totals. Details show the description, category, net and VAT. Invalid filters are explained and pages beyond the end redirect to the final page.
- Selectively port the existing local weekly CSV reconciliation from #143. Add a fictional format example, explicit clearing, 60-row pagination, stale-read protection and a strict 5,000-row bound. Summary totals always refer to the whole input file; detail filters do not silently change them. The feature performs no network upload, persistent browser storage, financial posting or email.
- Add 44 reviewed covering foreign-key indexes plus the cost-register ordering index. Production catalog showed each affected table below 132 KiB. DDL uses a two-second lock timeout and thirty-second statement timeout; failure aborts the migration. No rows, policies, grants, triggers or scheduled jobs are changed.

## Validation and release

- 290 local automated tests passed, including the real server-page query flow with 201 records, date/filter validation, cent reconciliation, fictional CSV example and 5,001-row rejection.
- Exact index SQL passed a rolled-back Staging rehearsal and was applied to Staging. Production requires its own rollback rehearsal before application.
- Existing Production security-advisor findings were recorded before changes; this release does not claim to remediate those unrelated findings.
- Run full build/typecheck and GitHub checks on release head; verify the isolated Staging Preview before merging.
- Preserve the current Production pilot by updating only `MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA` to the new main SHA, then verify a fresh production build. Do not change pilot users, grants, run state or enable flags.
- Check the live deployment, anonymous access gates and baseline register counts. No signed-in browser session was available in this workspace; do not claim a full user-session browser acceptance test.

## Recovery

Previous Production deployment: `dpl_6ueEPKATkSSkXrH9iFh65vHHkeUC` (same baseline SHA). The additional indexes are compatible with the old application and should remain on rollback. A rollback must restore the pilot release SHA for the rollback build; no database restore is required for this release.
