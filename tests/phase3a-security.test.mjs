// Dependency-free regression guardrails for Phase 3A. These inspect reviewed
// source invariants and never connect to Supabase, Vercel or Production.
// Live user-session/RLS acceptance is a separate release gate.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("a Preview has to match the single isolated Supabase Staging URL", () => {
  const helper = source("lib/security/phase3a-preview-isolation.ts");
  assert.match(helper, /process\.env\.VERCEL_ENV\s*!==\s*["']preview["']/);
  assert.match(helper, /senonkpxdtlhyhrubicg\.supabase\.co/);
  assert.match(helper, /process\.env\.NEXT_PUBLIC_SUPABASE_URL\s*===\s*PHASE3A_STAGING_URL/);
  assert.doesNotMatch(helper, /return\s+true\s*;\s*\/\/\s*preview/i);
});

test("every scoped administration entry point fails closed when Preview isolation is broken", () => {
  const entries = [
    "app/admin/group/layout.tsx",
    "app/admin/capital-requests/layout.tsx",
    "app/api/capital-requests/admin/route.ts",
  ];
  for (const path of entries) {
    const file = source(path);
    assert.match(file, /isPhase3aPreviewIsolated\(\)/, path);
    assert.match(file, /if\s*\(!isPhase3aPreviewIsolated\(\)\)/, path);
  }
  const api = source("app/api/capital-requests/admin/route.ts");
  assert.ok(api.indexOf("if (!isPhase3aPreviewIsolated())") < api.indexOf("await createClient()"),
    "API must reject unsafe Previews before accessing the database");
});

test("Capital administration uses caller-scoped RPCs, never a service-role bypass", () => {
  const api = source("app/api/capital-requests/admin/route.ts");
  const page = source("app/admin/capital-requests/page.tsx");
  assert.match(api, /supabase\.auth\.getUser\(\)/);
  assert.match(api, /supabase\.rpc\("mzs_capital_admin_update_request"/);
  assert.doesNotMatch(api, /SUPABASE_SERVICE_ROLE_KEY|serviceClient|createServiceClient/);
  assert.match(page, /supabase\.rpc\("mzs_capital_admin_list_requests"/);
  assert.doesNotMatch(page, /\.from\("mzs_capital_requests"\)/);
  assert.doesNotMatch(page, /\.from\("profiles"\)/);
});

test("Capital operators never inherit global Group or Estates access", () => {
  const group = source("app/admin/group/page.tsx");
  const estates = source("app/admin/group/estates/page.tsx");
  const layout = source("app/admin/group/layout.tsx");
  const login = source("app/login/page.tsx");
  for (const file of [group, estates]) {
    assert.match(file, /profile\?\.role\s*!==\s*"admin"/);
    assert.match(file, /profile\.is_active\s*!==\s*true/);
  }
  assert.match(layout, /mzs_has_department_scope/);
  assert.match(layout, /!groupAdmin\s*&&\s*!capitalAdmin/);
  assert.match(login, /mzs_has_department_scope/);
  assert.match(login, /"\/admin\/group\/capital"/);
});

test("Staging SQL keeps privileged writes audited and synthetic tests rollback-only", () => {
  const migration = source("supabase/migrations/20261018_phase3a_capital_requests_scoped_staging.sql");
  const sqlTest = source("supabase/tests/phase3a_capital_scopes_staging.sql");
  assert.match(migration, /mzs_capital_request_admin_audit/);
  assert.match(migration, /mzs_has_department_scope\('capital'\)/);
  assert.match(migration, /revoke all on function public\.mzs_capital_admin_update_request/);
  assert.match(migration, /grant execute on function public\.mzs_capital_admin_update_request.*to authenticated/);
  assert.match(migration, /raise exception 'Unauthorized' using errcode='42501'/i);
  assert.match(sqlTest, /MZS_CAPITAL_EXPECTED_ROLLBACK/);
  assert.match(sqlTest, /EXCEPTION WHEN SQLSTATE 'PZ999' THEN NULL/);
  assert.match(sqlTest, /Revoked Capital Admin still has write/);
});

test("Capital access pilot is Preview-only, Group-only, and limits UI to synthetic identities", () => {
  const page = source("app/admin/group/capital-access/page.tsx");
  const client = source("app/admin/group/capital-access/CapitalAccessPilot.tsx");
  assert.match(page, /process\.env\.VERCEL_ENV\s*!==\s*"preview"/);
  assert.match(page, /!isPhase3aPreviewIsolated\(\)/);
  assert.match(page, /profile\?\.role\s*!==\s*"admin"/);
  assert.match(page, /profile\.is_active\s*!==\s*true/);
  assert.match(client, /full_name\.startsWith\("Phase 3A Test "\)/);
  assert.match(client, /mzs_set_admin_department_scope/);
  assert.match(client, /p_department:\s*"capital"/);
  assert.match(client, /window\.confirm\(/);
});
