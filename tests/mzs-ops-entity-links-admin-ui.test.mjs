import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/admin/workspaces/estates/entities/page.tsx");
const action=read("app/admin/workspaces/estates/entities/actions.ts");
const form=read("app/admin/workspaces/estates/entities/EntityLinkForm.tsx");
const navigation=read("app/admin/workspaces/estates/page.tsx");
const css=read("app/admin/workspaces/estates/entities/entities.module.css");

test("Only active Group Admin on exact Staging or Production database can enter attribution",()=>{
 for(const text of [page,action]){
  assert.match(text,/VERCEL_ENV/);
  assert.match(text,/NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(text,/ptrnjzmcehrhbsfxntgw/);
  assert.match(text,/senonkpxdtlhyhrubicg/);
  assert.match(text,/await requireEstateAdmin\(\)/);
 }
 assert.match(page,/mzs_ops_property_entity_links/);
 assert.match(page,/\.order\("verified_at",\{ascending:false\}\)\.limit\(200\)/);
 assert.match(page,/x\.data\.length!==x\.count/);
 assert.doesNotMatch(page,/mzs_lease_invoices|mzs_capital_payments|rental_bookings|service_role|SUPABASE_SECRET/);
});
test("Every mutation needs explicit evidence and server-side revalidation, with no finance writes",()=>{
 assert.match(action,/^"use server"/);
 assert.match(action,/form\.get\("confirmed"\)!=="yes"/);
 assert.match(action,/\["owner","payer","manager"\]\.includes\(relation\)/);
 assert.match(action,/realDate\(effectiveFrom\)/);
 assert.match(action,/evidence\.length<6\|\|evidence\.length>500/);
 assert.match(action,/db\.from\("mzs_estate_properties"\)/);
 assert.match(action,/db\.from\("mzs_lease_issuers"\)/);
 assert.match(action,/db\.from\("mzs_ops_property_entity_links"\)\.insert\(/);
 assert.match(action,/error\?\.code==="23505"/);
 assert.doesNotMatch(action,/\.update\(|\.delete\(|sendMail|\.rpc\(|mzs_lease_invoices|mzs_capital_payments/);
 assert.match(form,/name="confirmed" value="yes" required/);
 assert.match(form,/immutable audit history/);
 assert.match(form,/cannot be removed/);
});
test("Navigation is admin-only, visually accessible, and links only to isolated module",()=>{
 assert.match(navigation,/await requireEstateAdmin\(\)/);
 assert.match(navigation,/entityLinksAvailable&&<Link/);
 assert.match(navigation,/href="\/admin\/workspaces\/estates\/entities"/);
 assert.match(form,/useActionState/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.confirmation/);
});
