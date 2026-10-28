import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("operating-cost API never swallows unauthenticated redirect into a financial 503",()=>{
 const s=read("app/api/admin/property-operations-costs/route.ts");
 const guard=s.indexOf("const {db}=await requireEstateAdmin()");
 const caught=s.indexOf("\n try{",s.indexOf("export async function GET"));
 assert.ok(guard>=0 && caught>=0 && guard<caught);
 assert.match(s,/no-store/);
 assert.match(s,/if\(process\.env\.VERCEL_ENV!=="preview"/);
});
test("staff work orders are internal only and require verified legal payer",()=>{
 const sql=read("supabase/migrations/20261028190000_mzs_ops_staff_corrections_internal_orders_staging.sql");
 const action=read("app/admin/workspaces/estates/staff/completion-actions.ts");
 assert.match(sql,/Verified property paying entity required/);
 assert.match(sql,/mzs_ops_visit_correction_decisions/);
 assert.match(sql,/original\.actual_minutes/);
 assert.match(action,/authorization|autoriseer|autoriser|authorized_internally/);
 assert.doesNotMatch(action,/sendMail|SMTP|service_role|mzs_lease_invoices|\.update\(/);
});
test("new MZS Ops FK indexes are additive and non destructive",()=>{
 const s=read("supabase/migrations/20261028194500_mzs_ops_fk_indexes_staging.sql");
 assert.equal(s.match(/create index if not exists ops_fka_\d\d on public\.mzs_ops_/g)?.length,25);
 assert.doesNotMatch(s,/\bdrop\b|\btruncate\b|\bdelete\b|\balter\s+table\b/i);
 assert.match(s,/commit;/i);
});
