import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const root="app/admin/workspaces/estates/expenses/";
const upload=read(root+"documents/route.ts");
const download=read(root+"documents/[id]/route.ts");
const review=read(root+"evidence-review-actions.ts");
const form=read(root+"ExpenseEvidenceReview.tsx");
const page=read(root+"page.tsx");

test("Document upload is Staging-only and requires origin, existing draft and explicit synthetic PDF consent",()=>{
 assert.match(upload,/process\.env\.VERCEL_ENV!=="preview"/);
 assert.match(upload,/senonkpxdtlhyhrubicg\.supabase\.co/);
 assert.match(upload,/await requireEstateAdmin\(\)/);
 assert.match(upload,/originIsValid\(request\)/);
 assert.match(upload,/confirmed_synthetic_file/);
 assert.match(upload,/source\.type!=="application\/pdf"/);
 assert.match(upload,/source\.size>4194304/);
 assert.match(upload,/detected\.mime!=="application\/pdf"/);
 assert.match(upload,/createHash\("sha256"\)/);
 assert.match(upload,/randomUUID\(\)/);
 assert.match(upload,/upsert:false/);
 assert.match(upload,/mzs_ops_expense_documents"\)\.insert/);
 assert.match(upload,/remove\(\[path\]\)/);
 assert.doesNotMatch(upload,/service_role|SMTP|sendMail|mzs_lease_invoices|mzs_booking_invoices/);
});
test("Signed download checks active Group Admin and issues one-minute download URLs with no-store",()=>{
 assert.match(download,/process\.env\.VERCEL_ENV!=="preview"/);
 assert.match(download,/await requireEstateAdmin\(\)/);
 assert.match(download,/mzs_ops_expense_documents/);
 assert.match(download,/createSignedUrl\(data\.storage_path,60,\{download:true\}\)/);
 assert.match(download,/Cache-Control":"no-store"/);
 assert.match(download,/Referrer-Policy":"no-referrer"/);
});
test("Review actions are Staging-only, explicitly synthetic and append-only, no financial posting",()=>{
 assert.match(review,/^"use server"/);
 assert.match(review,/confirmed_synthetic_review/);
 assert.match(review,/await requireEstateAdmin\(\)/);
 assert.match(review,/expected_state:expected/);
 assert.match(review,/mzs_ops_expense_review_events"\)\.insert/);
 assert.doesNotMatch(review,/service_role|sendMail|mzs_booking_invoices|mzs_lease_invoices|mzs_capital_payments/);
});
test("Browser review requires explicit synthetic consent, offers only PDF and stays invisible on Production",()=>{
 assert.match(form,/file\.type==="application\/pdf"/);
 assert.match(form,/confirmed_synthetic_file/);
 assert.match(form,/name="confirmed_synthetic_review"/);
 assert.match(form,/accept=".pdf,application\/pdf"/);
 assert.match(form,/malware-scanner/i);
 assert.match(page,/stagingEvidence&&<ExpenseEvidenceReview/);
 assert.match(page,/VERCEL_ENV==="preview"/);
 assert.match(page,/enabled=\{evidenceComplete\}/);
});
