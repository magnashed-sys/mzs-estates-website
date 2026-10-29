import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const functions={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/accountancy/supplier-integrity.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports:functions});
const {supplierCostIntegrity}=functions;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const comp=(n,name,tax_id)=>({id:id(n),name,kind:'company',company_details:tax_id===undefined?{}:{tax_id}});
const cost=(n,supplier)=>({id:id(n+100),supplier_relationship_id:id(supplier)});

test('existing supplier without a recorded VAT ID is flagged only as manual verification, never duplicated',()=>{
 const r=supplierCostIntegrity([cost(1,1)],[comp(1,'Maintenance Works',undefined)]);
 assert.equal(r.supplierCount,1);assert.equal(r.missingTaxIdSuppliers,1);assert.equal(r.possibleDuplicateSuppliers,0);
 assert.equal(r.signals[0].missing_record,false);
});
test('same normalized Spanish tax ID detects potential duplicate company entries without merging',()=>{
 const r=supplierCostIntegrity([cost(1,1)],[comp(1,'Costa Property SL','ES-B12345678'),comp(2,'Costa Propiedades, S.L.','ES B12345678')]);
 assert.equal(r.possibleDuplicateSuppliers,1);
 assert.equal(r.signals[0].possible_duplicate_records[0].reason,'same_tax_id');
 assert.equal(r.signals[0].possible_duplicate_records[0].id,id(2));
});
test('identical normalized names with one missing tax ID are a warning, not an automatic match or write',()=>{
 const r=supplierCostIntegrity([cost(1,1)],[comp(1,'  Villa Repairs, S.L. ','ESB09876543'),comp(2,'villa repairs s l',undefined)]);
 assert.equal(r.possibleDuplicateSuppliers,1);
 assert.equal(r.signals[0].possible_duplicate_records[0].reason,'same_name');
});
test('same company name with two known DIFFERENT tax IDs must never be reported as a duplicate',()=>{
 const r=supplierCostIntegrity([cost(1,1)],[comp(1,'Regional Group SL','ESB12345678'),comp(2,'Regional Group SL','ESB87654321')]);
 assert.equal(r.possibleDuplicateSuppliers,0);
 assert.equal(r.signals[0].possible_duplicate_records.length,0);
});
test('person suppliers are not forced to have company tax data and are not paired with companies',()=>{
 const suppliers=[{id:id(1),name:'Rosa Example',kind:'person',company_details:{}},comp(2,'Rosa Example',undefined)];
 const r=supplierCostIntegrity([cost(1,1),cost(2,2)],suppliers);
 assert.equal(r.supplierCount,2);assert.equal(r.missingTaxIdSuppliers,1);
 assert.equal(r.possibleDuplicateSuppliers,0);
 assert.equal(r.signals[0].possible_duplicate_records.length,0);
});
test('several invoice drafts for one supplier count the master record just once',()=>{
 const r=supplierCostIntegrity([cost(1,1),cost(2,1),cost(3,1),cost(4,2)],[
 comp(1,'Alpha Supplies','ESB12345678'),comp(2,'Beta Supplies','ESB87654321')
 ]);
 assert.equal(r.signals.length,4);
 assert.equal(r.supplierCount,2);
 assert.equal(r.missingTaxIdSuppliers,0);
});
test('missing historic supplier master record remains a non-mutating data-quality issue',()=>{
 const r=supplierCostIntegrity([cost(1,99)],[]);
 assert.equal(r.missingRecords,1);assert.equal(r.missingTaxIdSuppliers,0);
 assert.equal(r.signals[0].missing_record,true);
});
