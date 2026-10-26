import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("the central Bookings screen retrieves filtered, counted pages from the server",()=>{
 const source=read("app/admin/bookings/page.tsx");
 assert.match(source,/await requireEstateAdmin\(\)/);
 assert.match(source,/db\.rpc\("mzs_admin_bookings_search"/);
 assert.match(source,/p_query:query/);
 assert.match(source,/p_year:year/);
 assert.match(source,/p_property:property/);
 assert.match(source,/p_offset:offset/);
 assert.match(source,/p_limit:pageSize/);
 assert.match(source,/method="GET"/);
 assert.match(source,/Apply filters/);
 assert.match(source,/of.*matching records/);
 assert.match(source,/Next page/);
 assert.doesNotMatch(source,/\.limit\(250\)/);
});

test("the database search enforces the administrator guard and clamps page sizes",()=>{
 const sql=read("supabase/migrations/20261026171000_admin_bookings_server_search.sql");
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.mzs_admin_bookings_search/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/\(SELECT auth\.uid\(\)\) IS NULL/);
 assert.match(sql,/\(SELECT public\.is_admin\(\)\) IS DISTINCT FROM true/);
 assert.match(sql,/least\(greatest\(coalesce\(p_limit,25\),1\),100\)/);
 assert.match(sql,/LIMIT v_limit OFFSET v_offset/);
 assert.match(sql,/REVOKE ALL ON FUNCTION.*mzs_admin_bookings_search/s);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION.*mzs_admin_bookings_search[\s\S]*TO authenticated/);
});

test("owner stays are not duplicated and historical corrected billing data wins",()=>{
 const sql=read("supabase/migrations/20261026171000_admin_bookings_server_search.sql");
 assert.match(sql,/LEFT JOIN public\.mzs_booking_legacy_overrides o/);
 assert.match(sql,/coalesce\(o\.guest_name,s\.source_guest_name/);
 assert.match(sql,/coalesce\(o\.invoice_recipient_name,s\.invoice_recipient_name/);
 assert.match(sql,/WHERE NOT EXISTS\(SELECT 1 FROM public\.mzs_owner_stay_requests/);
 assert.match(sql,/UNION ALL/);
 assert.match(sql,/JOIN public\.mzs_property_partners/);
 assert.match(sql,/timezone\('Europe\/Madrid',now\(\)\)/);
 assert.match(sql,/strpos\(e\.search_blob,v_search\)>0/);
});
