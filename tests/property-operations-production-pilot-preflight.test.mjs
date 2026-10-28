import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const stagingGuards=[
 "lib/security/property-staff.ts",
 "app/admin/workspaces/estates/staff/actions.ts",
 "app/admin/workspaces/estates/staff/review-actions.ts",
 "app/admin/workspaces/estates/staff/completion-actions.ts",
 "app/admin/workspaces/estates/expenses/accountant-export/route.ts",
 "app/admin/workspaces/estates/expenses/sales-export/route.ts",
 "app/api/admin/property-operations-costs/route.ts",
 "app/api/staff/maintenance-photo/route.ts"
];
test("Draft staff, private evidence and accountant finance modules remain disabled in Production",()=>{
 for(const path of stagingGuards){
  const code=source(path);
  assert.match(code,/process\.env\.VERCEL_ENV/,"missing server-only Vercel env guard: "+path);
  assert.match(code,/process\.env\.NEXT_PUBLIC_SUPABASE_URL/,"missing database routing check: "+path);
  assert.match(code,/senonkpxdtlhyhrubicg\.supabase\.co/,"missing isolated Staging project guard: "+path);
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
