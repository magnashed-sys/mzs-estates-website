import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

test("Pilot schema denies unassigned access, financial writes, stale grants and disabled runs",()=>{
 const result=spawnSync(process.execPath,["tests/db/mzs-ops-isolated-pilot.cjs"],{
  encoding:"utf8",timeout:60000
 });
 assert.equal(result.status,0,result.stdout+"\n"+result.stderr);
});

test("Isolated pilot is review-only, never a Production migration or a financial integration",()=>{
 const filename="supabase/plans/20261028_mzs_ops_isolated_pilot_v1_review_only.sql";
 const sql=readFileSync(new URL("../"+filename,import.meta.url),"utf8");
 assert.match(sql,/Not a migration/);
 assert.match(sql,/without separate owner approval/i);
 for(const table of [
  "mzs_ops_pilot_runs","mzs_ops_pilot_run_events","mzs_ops_pilot_access_events",
  "mzs_ops_pilot_visits","mzs_ops_pilot_tickets"
 ]){
  assert.match(sql,new RegExp("create table public\\."+table+"\\b"));
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security"));
  assert.match(sql,new RegExp("revoke all on public\\."+table));
 }
 const noComments=sql.split("\n").filter(x=>!x.trimStart().startsWith("--")).join("\n");
 const noStrings=noComments.replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(noStrings,/\b(?:insert into|update|delete from|truncate|alter table|drop table)\s+public\.(?:mzs_lease_|mzs_booking_|mzs_capital_|rental_bookings)/i);
 assert.match(sql,/security_invoker=true/);
 assert.match(sql,/ops_pilot_run_active/);
 assert.match(sql,/ops_pilot_can_work/);
 assert.match(sql,/Pilot run can activate only once/);
});
