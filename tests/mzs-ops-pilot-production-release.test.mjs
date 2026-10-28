import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const prod=read("supabase/migrations/20261028161000_mzs_ops_isolated_pilot_production_off.sql");
const plan=read("supabase/plans/20261028_mzs_ops_isolated_pilot_v1_review_only.sql");
const body=s=>s.slice(s.indexOf("\nbegin;")+7,s.lastIndexOf("\ncommit;"));
test("Production pilot schema matches the reviewed, tested isolated pilot SQL exactly",()=>{
 assert.match(prod,/Production pilot isolated schema \/ RELEASE DEFAULT OFF/);
 assert.ok(plan.includes("begin;")&&plan.includes("commit;"));
 assert.ok(prod.includes(body(plan)),"Production core SQL must be exact plan body");
 for(const t of ["runs","run_events","access_events","visits","tickets"]){
  assert.match(prod,new RegExp("create table public\\.mzs_ops_pilot_"+t+"\\b"));
  assert.match(prod,new RegExp("alter table public\\.mzs_ops_pilot_"+t+" enable row level security"));
  assert.match(prod,new RegExp("revoke all on public\\.mzs_ops_pilot_"+t));
 }
 assert.equal((prod.match(/create index if not exists/g)||[]).length,8);
 assert.match(prod,/security_invoker=true/);
 assert.match(prod,/Pilot run can activate only once/);
});
test("Production pilot release never imports users, sends emails or changes existing finance",()=>{
 const noComments=prod.split("\n").filter(x=>!x.trimStart().startsWith("--")).join("\n");
 const noLiterals=noComments.replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(noLiterals,/\b(?:insert into|update|delete from|truncate|drop table|alter table)\s+public\.(?:profiles|mzs_lease_|mzs_booking_|mzs_capital_|mzs_owner_stay_|rental_bookings)/i);
 assert.doesNotMatch(noLiterals,/\binsert\s+into\s+public\.mzs_ops_pilot_(?:runs|run_events|access_events|visits|tickets)\b/i);
 assert.equal((prod.match(/\nbegin;/g)||[]).length,1);
 assert.equal((prod.match(/\ncommit;/g)||[]).length,1);
});
test("Pilot RLS still denies unauthorised clients, cross-property IDs and revoked users",()=>{
 const result=spawnSync(process.execPath,["tests/db/mzs-ops-isolated-pilot.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(result.status,0,result.stdout+"\n"+result.stderr);
});
