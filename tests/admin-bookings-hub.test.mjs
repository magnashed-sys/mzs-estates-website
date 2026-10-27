import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = path => readFileSync(new URL("../"+path, import.meta.url),"utf8");

test("canonical navigation keeps Bookings beside Group and routes legacy operations",()=>{
 const nav=source("app/admin/workspaces/WorkspaceNavigation.tsx");
 assert.ok(nav.indexOf('label:"Bookings"')<nav.indexOf('label:"MZS Estates"'));
 assert.match(nav,/href:"\/admin\/bookings"/);
 const operations=source("app/admin/bookings/operations/page.tsx");
 assert.match(operations,/await requireEstateAdmin\(\)/);
 assert.match(operations,/<BookingManagement/);
 assert.match(source("app/admin/page.tsx"),/redirect\(adminEntryRoute/);
});

test("new canonical Bookings routes reuse existing Estate-admin protected implementation",()=>{
 const index=source("app/admin/bookings/page.tsx");
 const detail=source("app/admin/bookings/[id]/page.tsx");
 assert.match(index,/requireEstateAdmin\(\)/);
 assert.match(index,/mzs_admin_bookings_search/);
 assert.match(detail,/\.\.\/\.\.\/unified-bookings\/\[id\]\/page/);
 assert.match(source("app/admin/unified-bookings/page.tsx"),/requireEstateAdmin\(\)/);
 assert.match(source("app/admin/unified-bookings/[id]/page.tsx"),/requireEstateAdmin\(\)/);
 assert.match(source("app/admin/group/estates/page.tsx"),/href="\/admin\/bookings"/);
});

test("central booking register retains historic source references and applies corrected billing identities",()=>{
 const page=source("app/admin/unified-bookings/page.tsx");
 const register=source("app/admin/unified-bookings/BookingRegister.tsx");
 assert.match(page,/mzs_booking_legacy_overrides/);
 assert.match(page,/overridesByBooking\.get\(b\.id\)\?\.invoice_recipient_name/);
 assert.match(page,/overridesByBooking\.get\(b\.id\)\?\.guest_name/);
 assert.match(page,/original_booking_number/);
 assert.match(page,/BookingRegister rows=/);
 assert.match(register,/Year \(check-in\)/);
 assert.match(register,/\/admin\/bookings\//);
 assert.match(register,/Europe\/Madrid/);
});

test("financial booking actions preserve guarded RPCs and use canonical dossier links",()=>{
 const actions=source("app/admin/unified-bookings/[id]/actions.ts");
 assert.match(actions,/requireEstateAdmin\(\)/);
 assert.match(actions,/mzs_admin_correct_legacy_booking/);
 assert.match(actions,/mzs_admin_record_booking_receipt/);
 assert.doesNotMatch(actions,/\/admin\/unified-bookings\//);
 assert.match(actions,/\/admin\/bookings\//);
 const legacyDossier=source("app/admin/unified-bookings/[id]/page.tsx");
 assert.match(legacyDossier,/Original confirmation & billing recipient/);
 assert.match(legacyDossier,/href="\/admin\/bookings"/);
 const arrivals=source("app/admin/BookingManagement.tsx");
 assert.match(arrivals,/href=\{"\/admin\/bookings\/"\+booking\.id\}/);
});
