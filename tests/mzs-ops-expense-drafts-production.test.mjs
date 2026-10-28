import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const sql=readFileSync(new URL("../supabase/migrations/20261028183500_mzs_ops_expense_drafts_production.sql",import.meta.url),"utf8");
test("Production schema strictly contains only two unseeded RLS expense-concept tables",()=>{
 assert.match(sql,/Production step 3A/);
 assert.equal((sql.match(/create table public\.mzs_ops_expense_draft/g)||[]).length,2);
 assert.match(sql,/mzs_ops_expense_drafts enable row level security/);
 assert.match(sql,/mzs_ops_expense_draft_audit enable row level security/);
 assert.match(sql,/Verified property paying entity required/);
 assert.match(sql,/Expense allocations do not reconcile/);
 assert.match(sql,/create trigger mzs_ops_expense_validate_insert/);
 assert.match(sql,/create trigger mzs_ops_expense_audit_insert/);
 assert.match(sql,/source_document_status text not null default 'missing'/);
 assert.match(sql,/status text not null default 'draft'/);
 assert.doesNotMatch(sql,/create table public\.mzs_ops_expense_documents/);
 const body=sql.split("\n").filter(x=>!x.trimStart().startsWith("--")).join("\n");
 const withoutLiterals=body.replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(withoutLiterals,/\b(?:update|delete from|truncate|alter table)\s+public\.(?:mzs_lease_|mzs_booking_|mzs_capital_|rental_bookings)/i);
 assert.doesNotMatch(withoutLiterals,/\binsert\s+into\s+public\.mzs_ops_expense_drafts\b/i);
 assert.equal((sql.match(/create index if not exists mzs_ops_expense_.*_fk/g)||[]).length,4);
});
test("Exact production DDL passes synthetic Postgres role, audit, immutable and allocation tests",()=>{
 const x=spawnSync(process.execPath,["tests/db/property-expense-drafts-production.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(x.status,0,x.stdout+"\n"+x.stderr);
});
