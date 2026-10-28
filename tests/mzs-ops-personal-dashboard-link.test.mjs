import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const route=read("app/api/private/pilot-access/route.ts");
const dashboard=read("app/private/page.tsx");
const style=read("app/private/privateDashboard.module.css");
const protectedPage=read("app/pilot/staff/page.tsx");

test("Only authenticated scoped pilot staff can receive a dashboard navigation hint",()=>{
 assert.match(route,/resolvePilotEnvironment\(\{/);
 assert.match(route,/MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA:process\.env\.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA/);
 assert.match(route,/VERCEL_GIT_COMMIT_SHA:process\.env\.VERCEL_GIT_COMMIT_SHA/);
 assert.match(route,/db\.auth\.getUser\(\)/);
 assert.match(route,/profile\?\.is_active!==true/);
 assert.match(route,/\["client","partner"\]\.includes/);
 assert.match(route,/mzs_ops_pilot_my_properties/);
 assert.match(route,/count!==1\|\|data\.length!==1/);
 assert.match(route,/property_name/);
 assert.match(route,/available:false/);
 assert.match(route,/private, no-store/);
 assert.doesNotMatch(route,/mzs_lease_|mzs_capital_|mzs_booking_|service_role|auth\.admin|grant|insert\(/i);
});

test("Personal dashboard renders staff link only for the exactly scoped signed-in user",()=>{
 assert.match(dashboard,/fetch\("\/api\/private\/pilot-access",\{cache:"no-store"\}\)/);
 assert.match(dashboard,/payload\.available!==true/);
 assert.match(dashboard,/setPilotAccess\(\{propertyName:payload\.propertyName\}\)/);
 assert.match(dashboard,/\{pilotAccess&&\(/);
 assert.match(dashboard,/href="\/pilot\/staff"/);
 assert.match(dashboard,/styles\.pilotAccess/);
 assert.match(dashboard,/Alleen fictieve testbezoeken en onderhoudsmeldingen/);
 assert.match(dashboard,/const projectIds =/);
 assert.ok(dashboard.indexOf('fetch("/api/private/pilot-access"')<
            dashboard.indexOf("const projectIds ="),
  "Staff entitlement check must remain independent of project/offering grants");
 assert.match(style,/\.pilotAccessLink/);
 assert.match(style,/@media\(max-width:650px\)/);
});

test("A dashboard link never replaces the actual staff page's server authorization",()=>{
 assert.match(protectedPage,/await requireOpsPilotStaff\(\)/);
 assert.doesNotMatch(route,/mzs_ops_pilot_access_events|profiles\.update|createUser|roles\.insert/);
});
