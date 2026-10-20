# Private Capital release and recovery plan

Prepared 20 October 2026. Preparation only; no Production writes authorised or
performed by this preparation. PR 19 remains draft. Do not promote the Staging
build: its compiled public Supabase configuration belongs to Staging.

## Verified inventory

- Staging: two real dossiers, 19 instalments, three private PDF metadata records,
  zero payment records on the real dossiers. All three referenced objects exist.
- Separate synthetic dossier: one instalment, one voided test payment; exclude
  the entire dossier, its schedule, payment and associated audit from import.
- Production: deals table absent; two active full administrators.
- Owner acceptance: dossiers, document operations, partial payment and correction,
  and non-admin access refusal. Automated checks recorded in the staging guide.
- No document bytes or production backup restore were verified in this preparation.

## Release gates

1. Confirm a recent completed, restorable Production database backup in the
   Supabase dashboard, recording timestamp and restore method immediately before
   migration. The earlier backup confirmation is not a new restore verification.
   Separately preserve original PDFs: database recovery is not a substitute for
   recovery of Storage file bytes.
2. Implement deliberate production enablement in `lib/security/capital-deals.ts`
   and the Capital navigation card. Current code supports Preview only. Require
   exact Production project URL AND a server-side opt-in flag, keeping Preview
   pinned to Staging. Retain active full-admin checks on every entry point.
   Test production flag absent/false, wrong project, cross-environment pairs,
   unauthenticated/client/scoped/inactive roles, and valid active full admin.
   Re-run TypeScript, the security suite and production build.
3. Review the exact release commit/diff and obtain explicit release approval.
4. Identify and record the currently serving Production deployment immediately
   before release; verify it is available as a rollback target.

## Ordered migration

Keep the production feature disabled while provisioning and checking data.

1. Run `supabase/tests/private_capital_deals_production_preflight.sql` read-only
   on Production. Stop if any module table, function or bucket already exists;
   inspect deployment/migration history rather than blindly reapplying SQL.
2. Apply the reviewed existing migration
   `20261020061042_private_capital_deals_staging.sql` to Production once, using a
   transaction and recording migration history. The name reflects its original
   Staging validation, not a request to copy the entire Staging database.
   It adds five module tables, restricted grants/policies/triggers and one private
   PDF bucket. It does not alter profiles, existing loans, SMTP or Auth users.
3. Build a secure explicit allowlist of the TWO owner-confirmed real dossier IDs.
   Re-read their rows and dependent instalments/documents immediately before
   import. Require exactly 2 dossiers, 19 instalments, 3 documents and 0 payments;
   stop and review any drift. Do not select all dossiers or rely solely on titles
   to exclude test data. Do not commit source rows, identities or PDFs to Git.
4. Import only allowlisted dossiers and instalments in one transaction, retaining
   their IDs and exact source values. Check for target ID collisions; do not use
   overwrite/upsert to conceal a partial import. Preserve unknown maturity and
   supplied final interest amount without recalculation. Carry review states as
   source assertions, not a new legal validation.
5. Transfer each original PDF through authenticated private Storage APIs to the
   new bucket, retaining document paths. Compare source/target byte length AND
   SHA-256 before importing its metadata. Do not copy `storage.objects` rows via
   SQL. If transfer access is unavailable, the full admin uploads the three
   original files through the production interface and verifies each download;
   this becomes an explicit remaining release check, never a silent completion.
6. Do not copy Staging users, credentials, tokens, grants, email settings or audit
   actor IDs into Production. New audited inserts establish Production import
   history. Retain Staging history for provenance and record the selected source
   IDs, source snapshot time, import operator and checksums in a protected record.
7. Verify row counts, exact schedules/terms, private bucket policy, PDF integrity,
   no synthetic dossier, no imported payments, and admin/non-admin isolation.
8. Build a NEW production-target deployment with Production configuration; enable
   only the deliberate server-side flag after schema/data verification. Merge or
   promote only under the explicit release approval. Do not reuse the Preview.
9. Smoke-test both full admins, client/non-admin denial, login, document downloads,
   existing Capital requests, public navigation and Estates. Do not generate
   fake payment entries on live loans. Stop rollout on any failed isolation test.

## Recovery

- Before data import: failed transactional migration should leave no partial
  state; inspect migration history and objects before retrying.
- After import or activation: disable the feature flag and redeploy, or roll back
  to the recorded pre-release Production deployment. Both hide the module while
  preserving data. Check direct pages/actions/downloads, not only navigation.
- Retain module tables, payment records, documents and audit. Do not DROP tables,
  delete financial entries, restore the entire database or copy Staging over
  Production as routine application rollback.
- A partial PDF transfer can leave private orphan files. Inventory them; retry
  only known missing files and metadata after checksum verification. Never
  overwrite an attached document to force the transfer to pass.
- If actual data corruption requires database recovery, stop affected writes,
  preserve post-backup changes, review impact on ALL modules, and obtain explicit
  approval for the recovery procedure. Restore database and Storage consistently.

## Remaining work

Production enablement code/tests; current backup and rollback-target verification;
release approval; protected source export/document transfer; Production migration,
new build and smoke tests. None is claimed completed by this document.
