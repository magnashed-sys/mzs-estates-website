import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/admin/system/page.tsx",import.meta.url),"utf8");
test("System pilot navigation is gated by the exact server Production release",()=>{
 assert.match(source,/await requireEstateAdmin\(\)/);
 assert.match(source,/resolvePilotEnvironment\(/);
 assert.match(source,/VERCEL_GIT_COMMIT_SHA:process\.env\.VERCEL_GIT_COMMIT_SHA/);
 assert.match(source,/MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA:process\.env\.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA/);
 assert.ok(source.includes('})==="production";'));
 assert.match(source,/isolatedPilotAvailable&&<section/);
 assert.ok(source.includes('href="/admin/property-operations-pilot"'));
});
test("Production pilot does not become a finance or generic staff portal",()=>{
 assert.match(source,/Geen facturen, salarissen of leveranciersopdrachten/);
 assert.doesNotMatch(source,/href=\"\/staff\"/);
});
