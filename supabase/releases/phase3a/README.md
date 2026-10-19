# Phase 3A core release candidate

Not deployed. Owner release approval is still required. These SQL files are
outside `supabase/migrations` deliberately: do not run an unrestricted `db push`.
The versioned filename was generated with `supabase migration new` and then
moved here for review without adding it to automatic migration discovery.

## Files

- `20261019214529_phase3a_core_release.sql`: three core schema steps in one
  transaction, no pilot RPCs, no test users, no initial scope grants.
- `disable-phase3a.sql`: emergency containment, not a destructive down migration.
  It revokes the new RPC entry points while preserving requests and audits.

The release adds explicit revocation of service-role EXECUTE on the new RPCs
and PUBLIC table access, in addition to the tested Staging-source rules. No
service-role client is required for the new administrative request workflow.

## Operator procedure (not executed)

1. Independently verify the connected project is the approved production ref
   `ptrnjzmcehrhbsfxntgw`, and record current website SHA/deployment and backup.
2. Review current schema drift against the readiness document. Confirm no
   phase3a/pilot objects exist. Check profiles/is_admin/request dependencies.
3. Only after release approval, set the following session acknowledgement in
   the same database connection as the selected SQL file:

   ```sql
   SET mzs.phase3a_release_authorized = 'ptrnjzmcehrhbsfxntgw';
   ```

   This is an operator acknowledgement, NOT a verified database identity.
   Do not set it merely to bypass an error or run against an unverified target.
4. Apply only the core release using the approved migration runner and register
   version `20261019214529` / name `phase3a_core_release` exactly once. Ensure
   the runner supports the file's transaction wrapper; do not independently
   commit each statement. On error, roll back and investigate; do not overwrite
   preexisting objects or skip the preflight.
5. Verify RLS on all three new tables; only authenticated may EXECUTE the four
   new RPCs, anon/service_role may not; authenticated has no direct scope/audit
   writes; no pilot RPCs; assignments empty. Re-check existing policies and data.
6. Publish only the reviewed website revision after database verification.
7. For containment, use the same verified connection and acknowledgement with
   `disable-phase3a.sql`, then restore the recorded old website deployment.
   Verify direct RPC denial and legacy operation. Do not delete data or restore
   a full database backup as the default rollback.

See `docs/phase3a-production-readiness-review.md` for limits, remaining gates
and production release sequence.

## Reproduce the local rehearsal

Install `@electric-sql/pglite@0.5.10` in a separate scratch directory (not an
application dependency). Run from the repository:

```sh
PGLITE_MODULE=/absolute/path/to/node_modules/@electric-sql/pglite/dist/index.js node scripts/phase3a-release-rehearsal.mjs
node --test tests/phase3a-security.test.mjs
```

The engine is local/in-memory, with no database URL or credentials. The fixture
reproduces the relevant production request schema, role enum, RLS and is_admin
behavior. Supabase Auth/profile-creation is a deliberately minimal test double;
unrelated project/rental schemas are not cloned. This does not test hosted
Supabase migration bookkeeping, concurrent sessions, PostgREST schema-cache
refresh, Vercel switching, SMTP, or a complete backup restore.

Result on 19 October 2026: all 11 rehearsal checkpoints passed, including the
two existing SQL role/audit suites. No remote schema or data changed.
