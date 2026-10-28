import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const route=source("app/admin/workspaces/estates/expenses/documents/[id]/scan/route.ts");
const page=source("app/admin/workspaces/estates/expenses/page.tsx");
const ui=source("app/admin/workspaces/estates/expenses/ExpenseEvidenceReview.tsx");
const adapter=source("lib/property-operations/scanner/cloudmersive-advanced.ts");

test("AV scanning is disabled until privacy consent, separate key and exact Staging origin",()=>{
 assert.match(adapter,/environment==="preview"/);
 assert.match(adapter,/supabaseUrl===STAGING_URL/);
 assert.match(adapter,/enabled==="true"/);
 assert.match(adapter,/processorApproved==="true"/);
 assert.match(adapter,/apiKey\.length>=20/);
 assert.match(route,/MZS_OPS_AV_SCAN_ENABLED/);
 assert.match(route,/MZS_OPS_AV_PROCESSOR_APPROVED/);
 assert.match(route,/MZS_OPS_CLOUDMERSIVE_API_KEY/);
 assert.match(route,/MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY/);
 assert.match(route,/if\(!scannerIsExplicitlyEnabled\(options\)\|\|!key\|\|key\.length<40\)/);
 assert.match(route,/return failure\(503/);
 assert.doesNotMatch(route,/process\.env\.SUPABASE_SERVICE_ROLE_KEY|process\.env\.NEXT_PUBLIC_.*KEY/);
});
test("Trigger requires an authenticated admin, same-site origin, original metadata and exact content hash before external transmission",()=>{
 assert.match(route,/export async function POST/);
 assert.match(route,/validOrigin\(request\)/);
 assert.match(route,/await requireEstateAdmin\(\)/);
 assert.match(route,/original\.storage_path\.startsWith\(original\.draft_id/);
 assert.match(route,/\.from\("mzs_ops_expense_documents"\)/);
 assert.match(route,/\.from\("mzs_ops_expense_document_scan_events"\)/);
 assert.match(route,/service\.storage\.from\(BUCKET\)/);
 assert.match(route,/\.download\(original\.storage_path\)/);
 assert.match(route,/createHash\("sha256"\)/);
 assert.match(route,/actual!==original\.sha256/);
 assert.match(route,/scanStagingPdfWithCloudmersive\(bytes,options\)/);
 assert.ok(route.indexOf("actual!==original.sha256")<route.indexOf("scanStagingPdfWithCloudmersive(bytes,options)"));
 assert.doesNotMatch(route,/\.update\(|\.delete\(|mzs_lease_invoices|mzs_capital_payments|rental_bookings|sendMail/);
});
test("Only the backend records scanner outcome with immutable SHA; never accepts browser verdict, paths or entity overrides",()=>{
 assert.match(route,/createSupabaseClient\(STAGING,key/);
 assert.match(route,/persistSession:false/);
 assert.match(route,/service\.from\("mzs_ops_expense_document_scan_events"\)\.insert\(/);
 assert.match(route,/observed_sha256:actual/);
 assert.match(route,/scanner_engine:scan\.engine/);
 assert.match(route,/scan_reference:"mzs-av-"\+randomUUID\(\)/);
 assert.match(route,/status:409/);
 assert.doesNotMatch(route,/request\.json\(|request\.formData\(|\.signedUrl|service_role/i);
});
test("Personal Cost UI shows scanner control only when provider and independent server key are configured",()=>{
 assert.match(page,/scannerIsExplicitlyEnabled\(\{/);
 assert.match(page,/scannerAvailable=\{scannerAvailable\}/);
 assert.match(page,/MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY\.length>=40/);
 assert.match(page,/stagingEvidence&&<ExpenseEvidenceReview/);
 assert.match(ui,/scannerAvailable&&!isCleared\(doc\)/);
 assert.match(ui,/Start externe virusscan/);
 assert.match(ui,/Externe malwarescanner nog niet geconfigureerd/);
 assert.match(ui,/if\(!scannerAvailable\|\|scanBusy\)return/);
 assert.match(ui,/method:"POST",credentials:"same-origin"/);
});
