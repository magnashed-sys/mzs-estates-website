import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const planPath="supabase/plans/20261028_mzs_ops_isolated_pilot_v1_review_only.sql";
const migrationPath="supabase/migrations/20261028153500_mzs_ops_isolated_pilot_staging.sql";
const plan=read(planPath),migration=read(migrationPath);
const stripHeader=(s)=>s.slice(s.indexOf("begin;"));
test("The staging migration matches the reviewed pilot schema exactly after comments",()=>{
 assert.match(migration,/STAGING-ONLY MIGRATION/);
 assert.match(migration,/Never automatically promote this SQL into Production/);
 assert.equal(stripHeader(migration),stripHeader(plan));
 assert.match(migration,/\bcommit;\s*$/);
});
test("The pilot schema starts OFF and never manipulates live financial, rental, or auth data",()=>{
 const ddl=migration.split("\n").filter(s=>!s.trimStart().startsWith("--")).join("\n");
 const withoutStrings=ddl.replace(/'(?:''|[^'])*'/g,"''");
 assert.match(ddl,/create table public\.mzs_ops_pilot_runs/);
 assert.match(ddl,/create table public\.mzs_ops_pilot_run_events/);
 assert.match(ddl,/create table public\.mzs_ops_pilot_access_events/);
 assert.match(ddl,/create table public\.mzs_ops_pilot_visits/);
 assert.match(ddl,/create table public\.mzs_ops_pilot_tickets/);
 assert.match(ddl,/security_invoker=true/);
 assert.doesNotMatch(withoutStrings,/\b(?:insert into|update|delete from|truncate|alter table|drop table)\s+public\.(?:profiles|mzs_lease_|mzs_booking_|mzs_capital_|rental_bookings)/i);
 assert.doesNotMatch(withoutStrings,/\binsert\s+into\s+public\.mzs_ops_pilot_(?:runs|run_events|access_events|visits|tickets)\b/i);
});
test("Pilot access remains disabled until explicit run activation and live one-worker grant",()=>{
 assert.match(migration,/ops_pilot_run_active/);
 assert.match(migration,/ops_pilot_can_work/);
 assert.match(migration,/Only one current pilot worker per run/);
 assert.match(migration,/Pilot run can activate only once/);
 for(const table of ["runs","run_events","access_events","visits","tickets"]){
  assert.match(migration,new RegExp("alter table public\\.mzs_ops_pilot_"+table+" enable row level security"));
  assert.match(migration,new RegExp("revoke all on public\\.mzs_ops_pilot_"+table));
 }
});
test("Real database schema acceptance remains reproducible offline with RLS roles",()=>{
 const run=spawnSync(process.execPath,["tests/db/mzs-ops-isolated-pilot.cjs"],{
  encoding:"utf8",timeout:60000
 });
 assert.equal(run.status,0,run.stdout+"\n"+run.stderr);
});
