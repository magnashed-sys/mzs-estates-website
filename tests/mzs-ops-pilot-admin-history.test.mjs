import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/admin/property-operations-pilot/page.tsx");
const styles=read("app/pilot/staff/pilot.module.css");

test("Pilot history requires admin identity and scoped RLS, never a service role",()=>{
 assert.match(page,/await requireOpsPilotAdmin\(\)/);
 assert.match(page,/mzs_ops_pilot_visits/);
 assert.match(page,/mzs_ops_pilot_tickets/);
 assert.doesNotMatch(page,/auth\.admin|service_role|SUPABASE_SECRET|\.update\(|\.delete\(|\.insert\(/);
 assert.doesNotMatch(page,/mzs_lease_invoices|mzs_booking_receipts|mzs_capital_deals|mzs_ops_expense_drafts/);
});

test("History lists preserve correct actor, property and source timestamps with bounded results",()=>{
 assert.match(page,/submitted_by,worked_on,actual_minutes,description,created_at/);
 assert.match(page,/reported_by,priority,title,description,created_at/);
 assert.match(page,/\.order\("created_at",\{ascending:false\}\)\.limit\(50\)/g);
 assert.match(page,/x\.count>=x\.data\.length/);
 assert.match(page,/x\.count<=50\?x\.count===x\.data\.length:x\.data\.length===50/);
 assert.match(page,/Laatste \{visits\.data!\.length\} van \{visits\.count\}/);
 assert.match(page,/Laatste \{tickets\.data!\.length\} van \{tickets\.count\}/);
 assert.match(page,/memberNames\.get\(visit\.submitted_by\)/);
 assert.match(page,/memberNames\.get\(ticket\.reported_by\)/);
 assert.match(page,/propertyNames\.get\(visit\.property_id\)/);
 assert.match(page,/propertyNames\.get\(ticket\.property_id\)/);
 assert.match(page,/timeZone:"Europe\/Madrid"/);
});

test("Prior inactive pilot workers remain in audit history but not grant dropdown",()=>{
 assert.match(page,/select\("id,full_name,role,is_active"/);
 assert.match(page,/members=\{\(members\.data\?\?\[\]\)\.filter\(member=>member\.is_active===true\)\}/);
 assert.match(page,/Onderhoudsmeldingen \(\{tickets\.count\}\)/);
 assert.match(page,/Werkbezoeken \(\{visits\.count\}\)/);
 assert.match(styles,/\.historyGrid\{/);
 assert.match(styles,/@media\(max-width:760px\)/);
 assert.match(styles,/\.historyDescription\{white-space:pre-wrap/);
});
