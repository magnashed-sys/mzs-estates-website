import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const stagingGuards=[
 "lib/security/property-staff.ts",
 "app/admin/workspaces/estates/staff/actions.ts",
 "app/admin/workspaces/estates/staff/review-actions.ts",
 "app/admin/workspaces/estates/staff/completion-actions.ts",
 "app/admin/workspaces/estates/expenses/entity-link-actions.ts",
 "app/admin/workspaces/estates/expenses/expense-draft-actions.ts",
 "app/admin/workspaces/estates/expenses/evidence-review-actions.ts",
 "app/admin/workspaces/estates/expenses/correction-actions.ts",
 "app/admin/workspaces/estates/expenses/correction-decision-actions.ts",
 "app/admin/workspaces/estates/expenses/replacement-actions.ts",
 "app/admin/workspaces/estates/expenses/documents/route.ts",
 "app/admin/workspaces/estates/expenses/documents/[id]/route.ts",
 "app/admin/workspaces/estates/expenses/accountant-export/route.ts",
 "app/admin/workspaces/estates/expenses/sales-export/route.ts",
 "app/admin/workspaces/estates/expenses/accountant-bundle/route.ts",
 "app/api/admin/property-operations-costs/route.ts",
 "app/api/staff/maintenance-photo/route.ts",
 "app/api/staff/maintenance-photo/[id]/route.ts"
];
test("Draft staff, private evidence and accountant finance modules remain disabled in Production",()=>{
 for(const path of stagingGuards){
  const code=source(path);
  assert.match(code,/process\.env\.VERCEL_ENV/,"missing server-only Vercel env guard: "+path);
  assert.match(code,/process\.env\.NEXT_PUBLIC_SUPABASE_URL/,"missing database routing check: "+path);
  assert.match(code,/senonkpxdtlhyhrubicg\.supabase\.co/,"missing isolated Staging project guard: "+path);
 }
});
test("Direct admin Staff and Expense URLs fail closed before querying any Production table",()=>{
 for(const path of [
  "app/admin/workspaces/estates/staff/page.tsx",
  "app/admin/workspaces/estates/expenses/page.tsx"
 ]){
  const code=source(path);
  const page=code.slice(code.indexOf("export default async function "));
  const firstDataRead=page.indexOf("await requireEstateAdmin()");
  assert.ok(firstDataRead>0,"missing admin auth on "+path);
  const guard=page.slice(0,firstDataRead);
  assert.match(guard,/if\(process\.env\.VERCEL_ENV!=="preview"[\s\S]*?process\.env\.NEXT_PUBLIC_SUPABASE_URL!=="https:\/\/senonkpxdtlhyhrubicg\.supabase\.co"\)[\s\S]*?notFound\(\);/,"missing fail-closed pre-query server guard: "+path);
 }
});
test("Staff page and mutations inherit the authenticated scope guard",()=>{
 for(const path of ["app/staff/page.tsx","app/staff/actions.ts","app/staff/correction-actions.ts"]){
  assert.match(source(path),/await requirePropertyStaff\(\)/,path+" must not bypass property grants");
 }
});
test("Every Production pilot needs separate test-data classification and cannot claim production-ready by default",()=>{
 const doc=source("docs/property-operations-production-pilot-readiness-20261028.md");
 assert.match(doc,/NO-GO now/);
 assert.match(doc,/MZS_OPS_PRODUCTION_PILOT_ENABLED=false/);
 assert.match(doc,/pilot_run_id/);
 assert.match(doc,/not a reviewed Production migration set|not a reviewed Production migration/i);
 assert.match(doc,/Catherine/i);
 assert.match(doc,/backup|restore/i);
 assert.match(doc,/approved test account/i);
 assert.match(doc,/retention/i);
});
test("Production operational navigation remains intentionally gated until piloting is approved",()=>{
 const estates=source("app/admin/workspaces/estates/page.tsx");
 const fin=source("app/admin/FinancialCockpit.tsx");
 assert.match(estates,/operationsStaging/);
 assert.match(estates,/process\.env\.VERCEL_ENV==="preview"/);
 assert.match(fin,/NEXT_PUBLIC_SUPABASE_URL==='https:\/\/senonkpxdtlhyhrubicg\.supabase\.co'/);
});

test("Production pilot SQL preflight is strictly read-only and checks existing registers",()=>{
 const sql=source("supabase/plans/20261028_property_operations_production_pilot_preflight.sql");
 const executable=sql.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
 assert.match(executable,/begin transaction read only;/i);
 assert.doesNotMatch(executable,/\b(?:create|alter|drop|truncate|insert|update|delete|grant|revoke|do|call)\b/i);
 for(const register of [
  "rental_bookings","mzs_booking_invoices","mzs_booking_receipts",
  "mzs_lease_contracts","mzs_lease_invoices","mzs_lease_payments",
  "mzs_capital_deals","mzs_capital_payments",
  "mzs_owner_stay_requests","mzs_estate_properties","mzs_estate_units"
 ])assert.ok(sql.includes("public."+register),"missing protected register "+register);
 assert.match(executable,/relrowsecurity/);
 assert.match(executable,/has_table_privilege\('anon'/);
 assert.match(executable,/commit;/i);
});
