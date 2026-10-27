import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const base="app/admin/workspaces/";
test("Workspaces layout and all independent pages verify active Group Administrator server-side",()=>{
 const layout=read(base+"layout.tsx");
 assert.match(layout,/await requireEstateAdmin\(\)/);
 assert.match(layout,/WorkspaceNavigation/);
 assert.match(layout,/robots:\{index:false,follow:false\}/);
 for(const path of ["group/page.tsx","estates/page.tsx","capital/page.tsx","relationships/page.tsx"]){
  const s=read(base+path);
  assert.match(s,/await requireEstateAdmin\(\)/,path);
  assert.match(s,/export const dynamic="force-dynamic"/,path);
 }
 assert.match(read(base+"page.tsx"),/redirect\("\/admin\/workspaces\/group"\)/);
});
test("Each cockpit has distinct specialist sources; no eager all-department reads",()=>{
 const group=read(base+"group/page.tsx");
 const estates=read(base+"estates/page.tsx");
 const capital=read(base+"capital/page.tsx");
 const relationships=read(base+"relationships/page.tsx");
 assert.match(group,/<FinancialCockpit/);
 assert.match(group,/<GroupActionCenter/);
 assert.doesNotMatch(group,/from\("mzs_(?:estate|capital|lease)_/);
 for(const table of ["mzs_estate_properties","mzs_estate_units","mzs_lease_contracts"])
  assert.ok(estates.includes('from("'+table+'")'),table);
 assert.doesNotMatch(estates,/mzs_capital_deals|mzs_capital_requests/);
 for(const table of ["mzs_capital_deals","mzs_capital_requests"])
  assert.ok(capital.includes('from("'+table+'")'),table);
 assert.doesNotMatch(capital,/mzs_estate_properties|mzs_lease_contracts/);
 for(const table of ["profiles","mzs_lease_relationships","access_requests"])
  assert.ok(relationships.includes('from("'+table+'")'),table);
 assert.doesNotMatch(relationships,/mzs_capital_deals|mzs_estate_units/);
 for(const s of [estates,capital,relationships]){
  assert.match(s,/count:"exact",head:true/);
  assert.match(s,/result\.error\|\|x\.result\.count===null/);
  assert.match(s,/role="alert"/);
 }
});
test("Workspaces link to existing guarded modules and preserve access to account requests",()=>{
 const layout=read(base+"layout.tsx");
 const nav=read(base+"WorkspaceNavigation.tsx");
 const legacy=read("app/admin/page.tsx");
 assert.match(layout,/href="\/admin\/accounts"/);
 assert.ok(legacy.includes("redirect(adminEntryRoute"));
 for(const route of ["/admin/workspaces/group","/admin/bookings","/admin/workspaces/estates","/admin/workspaces/capital","/admin/workspaces/relationships"])
  assert.ok(nav.includes(route),route);
 for(const path of ["estates/page.tsx","capital/page.tsx","relationships/page.tsx"]){
  const s=read(base+path);
  assert.match(s,/href="\/admin\//);
  assert.doesNotMatch(s,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
 }
});
