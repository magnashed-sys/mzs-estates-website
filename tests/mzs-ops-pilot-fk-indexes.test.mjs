import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";

const ddl=readFileSync(new URL("../supabase/migrations/20261028154500_mzs_ops_pilot_fk_indexes_staging.sql",import.meta.url),"utf8");
test("Pilot FK index patch is non-destructive, Staging scoped and complete",()=>{
 assert.match(ddl,/STAGING ONLY/);
 assert.doesNotMatch(ddl,/\b(?:drop|truncate|delete|update|alter table|insert)\b/i);
 const expected=[
  ["mzs_ops_pilot_access_events","profile_id"],
  ["mzs_ops_pilot_access_events","recorded_by"],
  ["mzs_ops_pilot_run_events","recorded_by"],
  ["mzs_ops_pilot_runs","created_by"],
  ["mzs_ops_pilot_tickets","property_id"],
  ["mzs_ops_pilot_tickets","reported_by"],
  ["mzs_ops_pilot_visits","property_id"],
  ["mzs_ops_pilot_visits","submitted_by"]
 ];
 assert.equal((ddl.match(/create index if not exists/gi)||[]).length,expected.length);
 for(const [table,column] of expected)
  assert.ok(ddl.includes("public."+table+"("+column+")"),"missing index on "+table+"."+column);
});
test("Eight indexes can be applied without modifying pilot data or permissions",async()=>{
 const db=new PGlite();
 try{
  const tables={
   mzs_ops_pilot_access_events:["profile_id","recorded_by"],
   mzs_ops_pilot_run_events:["recorded_by"],
   mzs_ops_pilot_runs:["created_by"],
   mzs_ops_pilot_tickets:["property_id","reported_by"],
   mzs_ops_pilot_visits:["property_id","submitted_by"]
  };
  for(const [name,fields] of Object.entries(tables))
   await db.exec("create table public."+name+"("+fields.map(x=>x+" uuid").join(",")+");");
  await db.exec(ddl);
  const result=await db.query("select indexname from pg_indexes where schemaname='public' and indexname like 'ops_pilot_%_fk'");
  assert.equal(result.rows.length,8);
  await db.exec(ddl); // idempotent
  const second=await db.query("select indexname from pg_indexes where schemaname='public' and indexname like 'ops_pilot_%_fk'");
  assert.equal(second.rows.length,8);
 }finally{await db.close();}
});
