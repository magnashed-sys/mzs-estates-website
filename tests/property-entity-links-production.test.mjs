import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261028175000_mzs_ops_entity_links_production.sql",import.meta.url),"utf8");
test("Legal attribution production schema is additive, unseeded and admin RLS protected",()=>{
 assert.match(sql,/Production \/ PHASE 2A/);
 assert.equal((sql.match(/create table public\.mzs_ops_property_entity_links \(/g)||[]).length,1);
 assert.equal((sql.match(/create table public\.mzs_ops_property_entity_link_audit \(/g)||[]).length,1);
 for(const table of ["mzs_ops_property_entity_links","mzs_ops_property_entity_link_audit"]){
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security"));
  assert.match(sql,new RegExp("revoke all on public\\."+table+" from public,anon,authenticated,service_role"));
 }
 assert.match(sql,/public\.is_admin\(\)/);
 assert.match(sql,/create trigger mzs_ops_link_audit_insert/);
 assert.match(sql,/No update or deletion yet/);
 const executable=sql.split("\n").filter(x=>!x.trimStart().startsWith("--")).join("\n");
 const cleaned=executable.replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(cleaned,/\b(?:insert into|update|delete from|alter table|drop table|truncate)\s+public\.(?:profiles|mzs_estate_properties|mzs_lease_|mzs_booking_|mzs_capital_|rental_bookings)/i);
 assert.doesNotMatch(cleaned,/\binsert\s+into\s+public\.mzs_ops_property_entity_links\b/i);
 assert.equal((sql.match(/create index if not exists mzs_ops_link_.*_fk/g)||[]).length,2);
});
test("Live database compatibility, role isolation, and audited immutable write verified with PGlite",()=>{
 const result=spawnSync(process.execPath,["tests/db/property-entity-links-production.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(result.status,0,result.stdout+"\n"+result.stderr);
});
