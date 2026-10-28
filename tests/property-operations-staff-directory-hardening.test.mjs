import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Staff directories use security-invoker views and private scoped helpers",()=>{
 const migration=readFileSync(new URL("../supabase/migrations/20261028173000_mzs_ops_secure_staff_directory_staging.sql",import.meta.url),"utf8");
 assert.match(migration,/security_invoker=true/);
 assert.match(migration,/ops_staff_property_labels/);
 assert.match(migration,/ops_staff_unit_labels/);
 assert.match(migration,/ops_can_work_on_property/);
 assert.match(migration,/revoke all on public.mzs_ops_staff_property_directory/);
 assert.match(migration,/grant select on public.mzs_ops_staff_property_directory/);
 assert.doesNotMatch(migration,/grant select.*mzs_estate_properties/);
});
