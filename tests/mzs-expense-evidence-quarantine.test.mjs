import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261028192000_mzs_expense_evidence_quarantine_staging.sql");
const page=read("app/admin/workspaces/estates/expenses/page.tsx");
const form=read("app/admin/workspaces/estates/expenses/ExpenseEvidenceReview.tsx");
const download=read("app/admin/workspaces/estates/expenses/documents/[id]/route.ts");
const upload=read("app/admin/workspaces/estates/expenses/documents/route.ts");

test("Staging migration enforces immutable scan journal and no browser verdict writes",()=>{
 assert.match(sql,/STAGING ONLY/);
 assert.match(sql,/create table public\.mzs_ops_expense_document_scan_events/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/grant select on public\.mzs_ops_expense_document_scan_events to authenticated/);
 assert.match(sql,/grant insert\(document_id,observed_sha256,verdict,scanner_engine,scanner_version,scan_reference\)\s+on public\.mzs_ops_expense_document_scan_events to service_role/);
 assert.doesNotMatch(sql,/grant insert[^;]*scan_events to authenticated/i);
 assert.match(sql,/new\.observed_sha256/);
 assert.match(sql,/original_sha is distinct from/);
 assert.match(sql,/drop policy if exists ops_evidence_read on storage\.objects/);
 assert.match(sql,/create policy ops_evidence_read on storage\.objects/);
 assert.match(sql,/e\.verdict='clean'/);
 assert.match(sql,/order by e\.id desc limit 1/);
 assert.match(sql,/ops_evidence_review_scan_gate_before_insert/);
 assert.match(sql,/Document is in quarantine until trusted scanner clearance/);
 assert.doesNotMatch(sql,/create policy [^\n]* on public\.(?:mzs_lease_|mzs_booking_|mzs_capital_)/);
 assert.doesNotMatch(sql,/update public\.mzs_ops_expense_documents|delete from public\.mzs_ops_expense_documents/i);
});
test("Authenticated server download fails closed without latest SHA-matching scanner clearance",()=>{
 assert.match(download,/await requireEstateAdmin\(\)/);
 assert.match(download,/mzs_ops_expense_document_scan_events/);
 assert.match(download,/latest\.verdict!=="clean"/);
 assert.match(download,/latest\.observed_sha256!==data\.sha256/);
 assert.match(download,/status:423/);
 assert.ok(download.indexOf('status:423')<download.indexOf('.createSignedUrl('));
 assert.match(download,/createSignedUrl\(data\.storage_path,60,\{download:true\}\)/);
});
test("Staging panel only reads complete scanner events and never offers pending download or review",()=>{
 assert.match(page,/const stagingEvidence=process\.env\.VERCEL_ENV==="preview"/);
 assert.match(page,/mzs_ops_expense_document_scan_events/);
 assert.match(page,/evidenceComplete/);
 assert.match(form,/scanEvents:ScanEvent\[\]/);
 assert.match(form,/scan\.id>previous\.id/);
 assert.match(form,/scan\?\.verdict==="clean"/);
 assert.match(form,/scan\.observed_sha256===d\.sha256/);
 assert.match(form,/Quarantaine — niet vrijgegeven/);
 assert.match(form,/scanCleared=\{isCleared\(doc\)\}/);
 assert.match(form,/scanCleared/);
 assert.match(upload,/quarantined:true/);
 assert.match(upload,/status:202/);
 assert.doesNotMatch(upload,/service_role|sendMail|mzs_booking_invoices|mzs_capital_payments/);
});
test("Offline synthetic Postgres fixture proves quarantine before scan and revocation after a later malicious verdict",()=>{
 const result=spawnSync(process.execPath,["tests/db/mzs-evidence-quarantine-staging.cjs"],{
  encoding:"utf8",timeout:60000
 });
 assert.equal(result.status,0,(result.stdout||"")+"\n"+(result.stderr||""));
});
