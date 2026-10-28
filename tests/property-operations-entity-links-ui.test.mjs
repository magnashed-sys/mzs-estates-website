import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("property/entity link is an explicit Staging-only admin action",()=>{
  const action=read("app/admin/workspaces/estates/expenses/entity-link-actions.ts");
  assert.match(action,/"use server"/);
  assert.match(action,/process\.env\.VERCEL_ENV!=="preview"/);
  assert.match(action,/https:\/\/senonkpxdtlhyhrubicg\.supabase\.co/);
  assert.match(action,/await requireEstateAdmin\(\)/);
  assert.match(action,/confirmed.*==="yes"/);
  assert.match(action,/evidence_reference:evidence/);
  assert.match(action,/db\.from\("mzs_ops_property_entity_links"\)\.insert\(/);
  assert.doesNotMatch(action,/mzs_lease_invoices|mzs_booking_invoices|sendMail|SMTP|service_role/i);
});
test("entity assignment requires complete admin-only read and shows previously audited links",()=>{
  const page=read("app/admin/workspaces/estates/expenses/page.tsx");
  const form=read("app/admin/workspaces/estates/expenses/PropertyEntityLinks.tsx");
  assert.match(page,/linkResult\.data\.length === linkResult\.count/);
  assert.match(page,/enabled=\{linksComplete\}/);
  assert.match(page,/<PropertyEntityLinks/);
  assert.match(form,/useActionState\(addVerifiedPropertyEntityLink/);
  assert.match(form,/Gecontroleerde bron of bewijs/);
  assert.match(form,/name="confirmed"/);
  assert.doesNotMatch(form,/\bfetch\(|\.insert\(|\.update\(|\.delete\(/);
});
test("first stage permission design refuses updates and deletes",()=>{
  const sql=read("supabase/migrations/20261028115000_mzs_ops_entity_links_staging.sql");
  assert.match(sql,/create policy mzs_ops_link_admin_insert/);
  assert.match(sql,/verified_by = \(select auth\.uid\(\)\)/);
  assert.match(sql,/create trigger mzs_ops_link_audit_insert/);
  assert.match(sql,/revoke all on public\.mzs_ops_property_entity_links from public,anon,authenticated,service_role/);
  assert.doesNotMatch(sql,/\bgrant\s+(update|delete)\b/i);
});
