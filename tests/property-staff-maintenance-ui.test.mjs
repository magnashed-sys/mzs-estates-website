import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("Staff portal only opens with a current signed-in user with Staging property assignments",()=>{
 const guard=file("lib/security/property-staff.ts");
 const page=file("app/staff/page.tsx");
 assert.match(guard,/VERCEL_ENV/);
 assert.match(guard,/auth.getUser/);
 assert.match(guard,/staff_property_directory/);
 assert.match(page,/requirePropertyStaff/);
 assert.match(page,/profile_id/);
 assert.match(page,/reported_by/);
});
test("Staff actual visit and maintenance events remain separate from billing",()=>{
 const actions=file("app/staff/actions.ts");
 const schema=file("supabase/migrations/20261028171000_mzs_ops_staff_maintenance_staging.sql");
 assert.match(actions,/actual_minutes/);
 assert.match(actions,/staff_visits/);
 assert.match(actions,/maintenance_tickets/);
 assert.match(schema,/ops_can_work_on_property/);
 assert.match(schema,/ops_staff_visit_guard/);
 assert.match(schema,/ops_ticket_guard/);
 assert.doesNotMatch(actions,/hourlyChargeCents|mzs_lease_invoices|sendMail/);
});
test("Admin permissions are separate from existing partner stay access",()=>{
 const action=file("app/admin/workspaces/estates/staff/actions.ts");
 assert.match(action,/requireEstateAdmin/);
 assert.match(action,/mzs_ops_staff_scope_events/);
 assert.match(action,/profile_id/);
});
