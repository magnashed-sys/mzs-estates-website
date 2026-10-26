import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = path => readFileSync(new URL("../"+path, import.meta.url),"utf8");

test("main Admin places Bookings in its own primary group, separated from estates and system",()=>{
 const admin=source("app/admin/page.tsx");
 const start=admin.indexOf('aria-label="Administration sections"');
 const end=admin.indexOf("</nav>",start);
 assert.ok(start>0&&end>start);
 const nav=admin.slice(start,end);
 for(const [title,expected] of [["GROUP","GROUP"],["BOOKINGS","BOOKINGS"],["MZS ESTATES","MZS ESTATES"],["MZS CAPITAL","MZS CAPITAL"],["RELATIONSHIPS","RELATIONSHIPS"],["SYSTEM","SYSTEM"]]){
   assert.ok(nav.includes(title),expected);
 }
 assert.ok(nav.indexOf("BOOKINGS")<nav.indexOf("MZS ESTATES"));
 assert.match(nav,/href="\/admin\/bookings"/);
 assert.match(nav,/Requests &amp; Calendar/);
 assert.match(nav,/href="\/admin\/owner-stays"/);
 assert.doesNotMatch(nav,/href="\/admin\/unified-bookings"/);
 assert.match(admin,/tab === "bookings" &&/);
 assert.match(admin,/BookingManagement key=\{`bookings-/);
});

test("new canonical Bookings routes reuse existing Estate-admin protected implementation",()=>{
 const index=source("app/admin/bookings/page.tsx");
 const detail=source("app/admin/bookings/[id]/page.tsx");
 assert.match(index,/\.\.\/unified-bookings\/page/);
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
