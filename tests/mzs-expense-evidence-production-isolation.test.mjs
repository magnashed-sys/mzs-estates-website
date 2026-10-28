import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const root="app/admin/workspaces/estates/expenses/";
const ui=read(root+"page.tsx");
const upload=read(root+"documents/route.ts");
const download=read(root+"documents/[id]/route.ts");
const review=read(root+"evidence-review-actions.ts");
const m=read("supabase/migrations/20261028192000_mzs_expense_evidence_quarantine_staging.sql");

test("Production does not expose new document uploads or reviews, even if already logged in",()=>{
 for(const target of [upload,download,review]){
  assert.match(target,/process\.env\.VERCEL_ENV!=="preview"/);
  assert.match(target,/senonkpxdtlhyhrubicg\.supabase\.co/);
  assert.match(target,/await requireEstateAdmin\(\)/);
 }
 assert.match(ui,/stagingEvidence&&<ExpenseEvidenceReview/);
 assert.match(ui,/process\.env\.VERCEL_ENV==="preview"/);
 assert.match(ui,/senonkpxdtlhyhrubicg\.supabase\.co/);
 assert.doesNotMatch(m,/ptrnjzmcehrhbsfxntgw/);
});

test("Only the supplier-evidence bucket is subjected to quarantine, no global storage policy change",()=>{
 assert.match(m,/drop policy if exists ops_evidence_read on storage\.objects/);
 assert.match(m,/create policy ops_evidence_read on storage\.objects/);
 assert.match(m,/bucket_id='mzs-ops-expense-evidence'/);
 assert.doesNotMatch(m,/drop policy.*(?:lease_documents_read|capital_documents_read|ops_ticket_photo_storage_read)/);
 assert.doesNotMatch(m,/alter table public\.(?:rental_bookings|mzs_lease_contracts|mzs_capital_deals)/);
});
