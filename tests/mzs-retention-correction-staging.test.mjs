import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261028202500_mzs_expense_evidence_retention_staging.sql");
const page=read("app/admin/workspaces/estates/expenses/page.tsx");
const action=read("app/admin/workspaces/estates/expenses/retention-actions.ts");
const forms=read("app/admin/workspaces/estates/expenses/ExpenseRetentionControls.tsx");

test("Per-entity retention is only proposed: nobody can alter existing documents, expire or delete them",()=>{
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/pending_local_accountant_review/);
 assert.match(sql,/check\(proposed_years between 1 and 30\)/);
 assert.match(sql,/legal_source_reference/);
 assert.match(sql,/mzs_ops_expense_retention_proposals enable row level security/);
 assert.match(sql,/mzs_ops_expense_document_holds enable row level security/);
 assert.match(sql,/for insert to authenticated with check/);
 assert.match(sql,/public\.is_admin\(\)/);
 assert.match(sql,/status text not null default 'pending_local_accountant_review'/);
 assert.match(sql,/disposition text not null default 'legal_hold_no_deletion'/);
 assert.doesNotMatch(sql,/create policy [^;]* for (?:delete|update)/i);
 assert.doesNotMatch(sql,/delete from|truncate|drop table|update public\.mzs_ops_expense_documents/i);
 assert.doesNotMatch(sql,/create table public\.(?:mzs_lease_|mzs_booking_|mzs_capital_)/);
});

test("Retention actions require real Group Admin, explicit confirmation and exact Staging guard",()=>{
 assert.match(action,/^"use server"/);
 assert.match(action,/process\.env\.VERCEL_ENV==="preview"/);
 assert.match(action,/senonkpxdtlhyhrubicg\.supabase\.co/);
 assert.match(action,/confirmed_legal_review/);
 assert.match(action,/confirmed_hold/);
 assert.match(action,/await requireEstateAdmin\(\)/g);
 assert.match(action,/mzs_ops_expense_retention_proposals"\)\.insert/);
 assert.match(action,/mzs_ops_expense_document_holds"\)\.insert/);
 assert.doesNotMatch(action,/\.update\(|\.delete\(|sendMail|service_role|mzs_lease_invoices|mzs_capital_payments/);
 assert.match(forms,/name="confirmed_legal_review"/);
 assert.match(forms,/name="confirmed_hold"/);
 assert.match(forms,/lokale accountant/);
});

test("Corrections and replacement links preserve originals, require explicit checks and stay Staging-only",()=>{
 for(const file of ["correction-actions.ts","correction-decision-actions.ts","replacement-actions.ts"]){
  const x=read("app/admin/workspaces/estates/expenses/"+file);
  assert.match(x,/process\.env\.VERCEL_ENV!=="preview"/);
  assert.match(x,/await requireEstateAdmin\(\)/);
  assert.match(x,/confirmed_immutable_correction/);
  assert.doesNotMatch(x,/\.update\(|\.delete\(|sendMail|service_role|mzs_lease_invoices|mzs_capital_payments/);
 }
 assert.match(page,/stagingEvidence&&<>/);
 assert.match(page,/ExpenseCorrections/);
 assert.match(page,/CorrectionDecisions/);
 assert.match(page,/ExpenseReplacementLinks/);
 assert.match(page,/ExpenseRetentionControls/);
 assert.match(page,/additionalComplete/);
});

test("In-memory PostgreSQL verifies admin holds/proposals, immutable history and client denial",()=>{
 const r=spawnSync(process.execPath,["tests/db/mzs-retention-staging.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(r.status,0,(r.stdout||"")+"\n"+(r.stderr||""));
});
