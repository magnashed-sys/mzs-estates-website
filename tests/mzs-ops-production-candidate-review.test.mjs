import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const candidate=read("supabase/plans/20261028_mzs_ops_pilot_production_candidate_review_only.sql");
const core=read("supabase/migrations/20261028153500_mzs_ops_isolated_pilot_staging.sql");
const index=read("supabase/migrations/20261028154500_mzs_ops_pilot_fk_indexes_staging.sql");
const executable=(text)=>text.slice(text.indexOf("begin;"));
test("Production candidate stays review-only, exact Stage SQL parity, no automatic migration",()=>{
 assert.match(candidate,/PRODUCTION CANDIDATE \/ REVIEW ONLY \/ DO NOT EXECUTE/);
 assert.match(candidate,/successful Production backup/);
 assert.equal(candidate.includes("create table public.mzs_ops_pilot_runs"),true);
 const coreSql=executable(core).trim();
 const indexSql=executable(index).trim();
 assert.ok(candidate.includes(coreSql),"candidate diverges from reviewed schema");
 assert.ok(candidate.includes(indexSql),"candidate diverges from index patch");
 assert.equal((candidate.match(/create table public\.mzs_ops_pilot_/g)||[]).length,5);
 assert.equal((candidate.match(/create index if not exists/g)||[]).length,8);
});
test("Candidate is default OFF, with no live account, invoice, booking, or capital mutation",()=>{
 const lines=candidate.split("\n").filter(x=>!x.trimStart().startsWith("--")).join("\n");
 const cleaned=lines.replace(/'(?:''|[^'])*'/g,"''");
 assert.match(cleaned,/ops_pilot_run_active/);
 assert.match(cleaned,/security_invoker=true/);
 assert.match(cleaned,/Pilot run can activate only once/);
 assert.doesNotMatch(cleaned,/\b(?:insert into|update|delete from|truncate|drop table|alter table)\s+public\.(?:profiles|mzs_lease_|mzs_booking_|mzs_capital_|rental_bookings)/i);
 assert.doesNotMatch(cleaned,/\binsert\s+into\s+public\.mzs_ops_pilot_(?:runs|run_events|access_events|visits|tickets)/i);
});
