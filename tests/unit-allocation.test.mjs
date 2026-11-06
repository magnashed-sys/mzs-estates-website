import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
function module(file){
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
 return exports;
}
const {unitAllocation,contractNet}=module('lib/estates/unit-contracts.ts');
const {effectiveLeaseLines}=module('lib/estates/lease-pricing.ts');
const contract={id:'joint',unit_ids:['unit-001','unit-003'],first_period:'2026-12-01',pricing_basis:'separate',line_roles:['rent','advance','rent','advance'],lines:[
 {unit_id:'unit-001',description:'Rent 001',amount:'753.43',vat:'0'},
 {unit_id:'unit-001',description:'Utilities 001',amount:'50.00',vat:'21'},
 {unit_id:'unit-003',description:'Rent 003',amount:'753.43',vat:'0'},
 {unit_id:'unit-003',description:'Utilities 003',amount:'50.00',vat:'21'}
]};
test('joint rent reconciles exactly to two unit allocations without counting advance or VAT as rent',()=>{
 const a=unitAllocation(contract,'unit-001'),b=unitAllocation(contract,'unit-003');
 assert.deepEqual({...a},{rent:75343,advance:5000,other:0,all_in:0,net:80343,tax:1050,total:81393});
 assert.deepEqual({...a},{...b});
 assert.equal(a.net+b.net,Math.round(contractNet(contract)*100));
 assert.equal(a.total+b.total,162786);
});
test('no inferred allocation for absent, incomplete, unknown or unclassified assignments',()=>{
 assert.equal(unitAllocation(contract,'outsider'),null);
 for(const change of [
  {lines:contract.lines.map(({unit_id,...l})=>l)},
  {lines:contract.lines.map((l,i)=>i===3?{...l,unit_id:'outsider'}:l)},
  {lines:contract.lines.map(l=>({...l,unit_id:'unit-001'}))},
  {line_roles:[]},{pricing_basis:'unclassified'},{first_period:undefined},
  {lines:contract.lines.map((l,i)=>i===1?{...l,amount:'50.005'}:l)},
  {lines:contract.lines.map((l,i)=>i===1?{...l,vat:'invalid'}:l)}
 ])assert.equal(unitAllocation({...contract,...change},'unit-001'),null);
});
test('VAT rounds on each invoice line and all-in amounts remain all-in',()=>{
 const c={...contract,pricing_basis:'all_in',line_roles:['all_in','all_in','all_in'],lines:[
  {unit_id:'unit-001',amount:'0.03',vat:'21'},
  {unit_id:'unit-001',amount:'0.03',vat:'21'},
  {unit_id:'unit-003',amount:'0.06',vat:'exempt'}]};
 const a=unitAllocation(c,'unit-001');
 assert.equal(a.tax,2);assert.equal(a.rent,0);assert.equal(a.all_in,6);assert.equal(a.total,8);
});
test('approved future pricing preserves unit assignments and applies only from its effective date',()=>{
 const changed=contract.lines.map((l,i)=>i%2===0?{...l,amount:'800.00'}:l);
 const adjustments=[
  {status:'approved',effective_on:'2027-01-01',revision:1,new_lines:changed},
  {status:'proposed',effective_on:'2026-12-01',revision:2,new_lines:changed}];
 const december={...contract,lines:effectiveLeaseLines(contract,adjustments,'2026-12-01')};
 const january={...contract,lines:effectiveLeaseLines(contract,adjustments,'2027-01-01')};
 assert.equal(unitAllocation(december,'unit-001').rent,75343);
 assert.equal(unitAllocation(january,'unit-001').rent,80000);
 assert.equal(unitAllocation(january,'unit-003').total,86050);
});
