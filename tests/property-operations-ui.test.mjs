import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
function load(path) {
 const source=read(path);
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(js,{exports,require:name=>{
  if(path==="lib/property-operations/expense-preview.ts" && name==="./finance")return load("lib/property-operations/finance.ts");
  throw new Error("Unexpected module "+name);
 }});
 return exports;
}
const {inputEuroCents,expenseAllocationPreview}=load("lib/property-operations/expense-preview.ts");

test("Euro expense inputs are parsed into exact cents without floating-point drift",()=>{
 assert.equal(inputEuroCents("100,01"),10001);
 assert.equal(inputEuroCents("0.5"),50);
 assert.equal(inputEuroCents("21"),2100);
 assert.equal(inputEuroCents("0,00"),0);
 for(const bad of ["-1","1.234,56","1e3","21,123","", "  ","€ 15","abc"]){
  assert.throws(()=>inputEuroCents(bad),/bedrag/i);
 }
});
test("equal unit allocation preserves net, VAT and gross to the cent, regardless of unit display order",()=>{
 const units=["unit-c","unit-a","unit-b"];
 const r=expenseAllocationPreview(10001,2100,"equal-units","building",units);
 const sorted=expenseAllocationPreview(10001,2100,"equal-units","building",[...units].reverse());
 assert.equal(r.length,3);
 assert.equal(r.reduce((sum,x)=>sum+x.netCents,0),10001);
 assert.equal(r.reduce((sum,x)=>sum+x.vatCents,0),2100);
 assert.equal(r.reduce((sum,x)=>sum+x.grossCents,0),12101);
 assert.deepEqual(JSON.parse(JSON.stringify(r)),JSON.parse(JSON.stringify(sorted)));
});
test("specific unit and whole-property examples never leak the cost to another unit",()=>{
 const a=expenseAllocationPreview(10000,2100,"unit","building",["one","two"],"two");
 assert.deepEqual(JSON.parse(JSON.stringify(a)),[{targetId:"two",netCents:10000,vatCents:2100,grossCents:12100}]);
 const b=expenseAllocationPreview(10000,2100,"property","building",[]);
 assert.deepEqual(JSON.parse(JSON.stringify(b)),[{targetId:"building",netCents:10000,vatCents:2100,grossCents:12100}]);
 assert.throws(()=>expenseAllocationPreview(10000,2100,"unit","building",["one"],"other"),/geldige unit/i);
 assert.throws(()=>expenseAllocationPreview(10000,2100,"equal-units","building",[]),/geldige unit/i);
 assert.throws(()=>expenseAllocationPreview(10000,2100,"equal-units","building",["one","one"]),/Dubbele units/);
});
test("expense preview route explicitly verifies the active administrator and complete RLS reads before rendering",()=>{
 const page=read("app/admin/workspaces/estates/expenses/page.tsx");
 const layout=read("app/admin/workspaces/layout.tsx");
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(layout,/await requireEstateAdmin\(\)/);
 for(const table of ["mzs_lease_issuers","mzs_estate_properties","mzs_estate_units","mzs_lease_relationships"]){
  assert.ok(page.includes('from("'+table+'")'),"missing "+table);
 }
 assert.match(page,/count:"exact"/);
 assert.match(page,/value\.data\.length !== value\.count/);
 assert.match(page,/role="alert"/);
 assert.match(page,/force-dynamic/);
 assert.doesNotMatch(page,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});
test("preview cannot persist or issue invoices and stays visibly labelled as a draft",()=>{
 const page=read("app/admin/workspaces/estates/expenses/page.tsx");
 const component=read("app/admin/workspaces/estates/expenses/ExpenseCalculator.tsx");
 const cockpit=read("app/admin/workspaces/estates/page.tsx");
 assert.match(cockpit,/href="\/admin\/workspaces\/estates\/expenses"/);
 assert.match(page,/Niet opslaan/);
 assert.match(component,/nog uitgeschakeld/);
 assert.match(component,/expenseAllocationPreview\(/);
 assert.doesNotMatch(component,/\bfetch\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(|[.]rpc\(|submit.*invoice/i);
});
