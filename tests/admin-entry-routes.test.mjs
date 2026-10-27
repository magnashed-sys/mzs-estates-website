import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/admin/entry-route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams});
test("legacy entry links preserve filters and route each register",()=>{
 for(const [tab,path] of Object.entries({relationships:"accounts",companies:"member-companies",projects:"projects",analytics:"system",bookings:"bookings/operations"})){
  assert.equal(exports.adminEntryRoute({tab,filter:"all"}),"/admin/"+path+"?filter=all");
 }
 assert.equal(exports.adminEntryRoute({}),"/admin/workspaces/group");
 assert.equal(exports.adminEntryRoute({tab:"https://example.invalid"}),"/admin/workspaces/group");
 assert.equal(exports.adminEntryRoute({tab:"__proto__"}),"/admin/workspaces/group");
 assert.equal(exports.adminEntryRoute({tab:["projects","analytics"]}),"/admin/workspaces/group");
 assert.equal(exports.adminEntryRoute({tab:"projects",q:"A & B"}),"/admin/projects?q=A+%26+B");
});
test("specialist routes independently enforce administrator access",()=>{
 for(const route of ["accounts","member-companies","projects","system"]){
  const code=readFileSync(new URL("../app/admin/"+route+"/page.tsx",import.meta.url),"utf8");
  assert.ok(code.indexOf("await requireEstateAdmin()")<code.indexOf("return <AdminPanels"));
 }
 const panel=readFileSync(new URL("../app/admin/AdminPanels.tsx",import.meta.url),"utf8");
 assert.ok(panel.includes('profile?.role !== "admin"'));
 assert.ok(panel.includes('profile.is_active !== true'));
 assert.ok(panel.includes("if(locked||actionLock.current||next===tab)return;"));
});
