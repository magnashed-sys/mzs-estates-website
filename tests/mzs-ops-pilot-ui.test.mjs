import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Pilot staff identity is checked server-side, before reading any trial records",()=>{
 const gate=src("lib/security/property-ops-pilot.ts");
 const page=src("app/pilot/staff/page.tsx");
 assert.match(gate,/resolvePilotEnvironment\(process\.env\)/);
 assert.match(gate,/auth\.getUser\(\)/);
 assert.match(gate,/profile\.is_active!==true/);
 assert.match(gate,/\["client","partner"\]/);
 assert.match(gate,/mzs_ops_pilot_my_properties/);
 assert.match(gate,/data\.length!==1/);
 assert.match(page,/await requireOpsPilotStaff\(\)/);
 assert.match(page,/visits\.count!==visits\.data\.length/);
 assert.match(page,/tickets\.count!==tickets\.data\.length/);
});
test("Pilot mutation never accepts client-submitted run or property IDs or posts live financial records",()=>{
 const actions=src("app/pilot/staff/actions.ts");
 assert.match(actions,/^"use server"/);
 assert.match(actions,/await requireOpsPilotStaff\(\)/g);
 assert.match(actions,/assignment\.run_id/);
 assert.match(actions,/assignment\.property_id/);
 assert.match(actions,/confirmed_synthetic/);
 assert.doesNotMatch(actions,/form\.get\(["'](?:run_id|property_id|profile_id)/);
 assert.doesNotMatch(actions,/mzs_lease_|mzs_booking_|mzs_capital_|sendMail|\.rpc\(|\.update\(|\.delete\(/);
 assert.match(actions,/mzs_ops_pilot_visits/);
 assert.match(actions,/mzs_ops_pilot_tickets/);
});
test("Staff trial forms display synthetic-only notice and do not issue anything",()=>{
 const forms=src("app/pilot/staff/PilotForms.tsx");
 const page=src("app/pilot/staff/page.tsx");
 assert.match(forms,/useActionState/);
 assert.match(forms,/confirmed_synthetic/);
 assert.match(page,/TESTGEGEVENS — PILOT/);
 assert.match(page,/Geen echte facturatie/);
 assert.doesNotMatch(page,/service_role|auth\.admin|SUPABASE_SECRET/);
});
