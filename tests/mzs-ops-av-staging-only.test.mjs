import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const route=read("app/admin/workspaces/estates/expenses/documents/[id]/scan/route.ts");
const scanner=read("lib/property-operations/scanner/cloudmersive-advanced.ts");
const page=read("app/admin/workspaces/estates/expenses/page.tsx");

test("Scanner variables are server-only, explicit and separate from Production pilot flags",()=>{
 for(const key of [
  "MZS_OPS_AV_SCAN_ENABLED","MZS_OPS_AV_PROCESSOR_APPROVED",
  "MZS_OPS_CLOUDMERSIVE_API_KEY",
  "MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY"
 ])assert.match(route,new RegExp(key));
 assert.doesNotMatch(route,/NEXT_PUBLIC_.*(API_KEY|SERVICE_ROLE_KEY)/);
 assert.doesNotMatch(route,/MZS_OPS_PRODUCTION_PILOT_ENABLED|MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA/);
 assert.match(route,/const STAGING="https:\/\/senonkpxdtlhyhrubicg\.supabase\.co"/);
 assert.match(scanner,/const STAGING_URL="https:\/\/senonkpxdtlhyhrubicg\.supabase\.co"/);
 assert.doesNotMatch(scanner,/https:\/\/ptrnjzmcehrhbsfxntgw/);
});
test("Pending, malicious or invalid scan cannot be unblocked by a client-side dashboard flag",()=>{
 assert.match(page,/stagingEvidence&&<ExpenseEvidenceReview/);
 assert.match(page,/scannerIsExplicitlyEnabled/);
 assert.match(route,/if\(previous&&previous\.verdict!=="unscannable"\)/);
 assert.match(route,/\.eq\("document_id",id\)/);
 assert.match(route,/scanStagingPdfWithCloudmersive\(bytes,options\)/);
 assert.match(route,/observed_sha256:actual/);
 assert.doesNotMatch(route,/const verdict=request|form\.get\("verdict"\)|request\.json\(/);
});
