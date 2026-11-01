import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/plans/20261028_mzs_ops_production_clone_preflight_read_only.sql",import.meta.url),"utf8");

test("Production clone preflight cannot write, copy data, restore or expose scheduled job commands",()=>{
 const executable=sql.split("\n").filter(x=>!x.trimStart().startsWith("--")).join("\n");
 const withoutSqlStrings=executable.replace(/'(?:''|[^'])*'/g,"''");
 assert.match(executable,/begin transaction read only;/i);
 assert.match(executable,/commit;/i);
 assert.doesNotMatch(withoutSqlStrings,/\b(?:create|alter|drop|truncate|insert|update|delete|grant|revoke|call|copy|vacuum)\b/i);
 assert.doesNotMatch(executable,/cron\.command\s*(?:as|,|from)|select\s+\*\s+from\s+cron\.job/i);
 assert.match(executable,/from cron\.job;/);
 assert.match(executable,/active_scheduled_jobs/);
 assert.match(executable,/to_regprocedure\('public\.is_admin\(\)'\)/);
});
test("Preflight checks all legacy financial and property register baselines without exporting PII",()=>{
 for(const table of [
  "rental_bookings","mzs_booking_receipts","mzs_booking_invoices",
  "mzs_lease_contracts","mzs_lease_invoices","mzs_capital_deals",
  "mzs_capital_payments","mzs_owner_stay_requests",
  "mzs_estate_properties","mzs_estate_units"
 ])assert.match(sql,new RegExp("public\\."+table+"\\b"),table);
 assert.doesNotMatch(sql,/auth\.users|email_address|first_name|last_name|password_hash|pg_read_file/i);
});
