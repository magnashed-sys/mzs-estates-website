import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const model={};
let invoiceRows=[];
const transpiled=ts.transpileModule(src('lib/accountancy/property-financial-report.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(transpiled,{exports:model,require:id=>{
  if(id==='./cost-centers')return {yearIncome:()=>invoiceRows};
  if(id==='./administration')return {annualCategory:x=>x};
  throw Error('Unexpected dependency '+id);
}});
const report=model.propertyFinancialReport;
const ID1='11111111-1111-4111-8111-111111111111',ID2='22222222-2222-4222-8222-222222222222',PROJ='33333333-3333-4333-8333-333333333333';
function setup(){
 invoiceRows=[
  {allocation_source:'leases',invoice_id:'i-a',gross_cents:121000,invoice_date:'2026-01-14',allocation:{property_id:ID1,project_id:null}},
  {allocation_source:'services',invoice_id:'i-b',gross_cents:242000,invoice_date:'2026-02-10',allocation:{property_id:ID2,project_id:PROJ}},
  {allocation_source:'external',invoice_id:'i-c',gross_cents:45000,invoice_date:'2026-01-17',allocation:undefined}
 ];
 return {
  administration:{id:'year',issuer_id:'issuer',fiscal_year:2026},
  projects:[{id:PROJ,year_id:'year',name:'Renovation',property_id:ID2}],
  sales:{credit_notes:[{id:'c-1',invoice_id:'i-b',issuer_id:'issuer',issued_on:'2026-03-08',gross_cents:10000}]},
  costs:[
   {id:'c-a',property_id:ID1,legal_entity_id:'issuer',invoice_date:'2026-01-25',category:'maintenance',gross_cents:20000},
   {id:'c-b',property_id:ID2,legal_entity_id:'issuer',invoice_date:'2026-02-20',category:'renovation',gross_cents:50000},
   {id:'c-c',property_id:ID2,legal_entity_id:'issuer',invoice_date:'2026-02-23',category:'maintenance',gross_cents:15000},
   {id:'c-d',property_id:null,legal_entity_id:'issuer',invoice_date:'2026-04-17',category:'management',gross_cents:7000}
  ],
  reviews:[
   {draft_id:'c-a',review_status:'reviewed',category:'maintenance',project_id:null},
   {draft_id:'c-b',review_status:'reviewed',category:'renovation',project_id:PROJ},
   {draft_id:'c-c',review_status:'pending',category:'maintenance',project_id:null},
   {draft_id:'c-d',review_status:'excluded',category:'management',project_id:null}
  ]
 };
}
test('Entity financial overview keeps unallocated invoicing and reviewed vs pending purchase concepts distinct',()=>{
 const source=setup(),r=report(source);
 const t=r.totals;
 assert.equal(t.invoicedGross,408000);
 assert.equal(t.creditsGross,10000);
 assert.equal(t.reviewedCostGross,70000);
 assert.equal(t.pendingCostGross,15000);
 assert.equal(t.excludedCostGross,7000);
 assert.equal(t.maintenanceGross,35000);
 assert.equal(t.renovationGross,50000);
 assert.equal(t.unallocatedInvoiceCount,1);
 assert.equal(t.unallocatedIncomeGross,45000);
 assert.equal(t.invoiceCount,3);
 assert.equal(t.creditCount,1);
 assert.equal(t.costCount,4);
 assert.equal(r.months.length,12);
 assert.equal(r.months[0].invoicedGross,166000);
 assert.equal(r.months[1].reviewedCostGross,50000);
 assert.equal(r.months[2].creditsGross,10000);
 assert.equal(r.months[3].excludedCostGross,7000);
});

test('Property and project reports use explicit allocations only, never free-text names or implicit splits',()=>{
 const source=setup();
 const p1=report(source,{propertyId:ID1}).totals;
 assert.equal(p1.invoicedGross,121000);
 assert.equal(p1.reviewedCostGross,20000);
 assert.equal(p1.creditsGross,0);
 assert.equal(p1.unallocatedIncomeGross,0);
 assert.equal(p1.pendingCostGross,0);
 const p2=report(source,{propertyId:ID2}).totals;
 assert.equal(p2.invoicedGross,242000);
 assert.equal(p2.creditsGross,10000);
 assert.equal(p2.reviewedCostGross,50000);
 assert.equal(p2.pendingCostGross,15000);
 const project=report(source,{projectId:PROJ}).totals;
 assert.equal(project.invoicedGross,242000);
 assert.equal(project.creditsGross,10000);
 assert.equal(project.reviewedCostGross,50000);
 assert.equal(project.pendingCostGross,0);
 assert.throws(()=>report(source,{propertyId:ID1,projectId:PROJ}),/Project outside selected property/);
 assert.throws(()=>report(source,{projectId:'missing'}),/Unknown project/);
});

test('Invoice and cost duplication or invalid source data fails closed before rendering amounts',()=>{
 let source=setup();
 invoiceRows.push({...invoiceRows[0]});
 assert.throws(()=>report(source),/Duplicated issued invoice/);
 source=setup();
 source.costs.push({...source.costs[0]});
 assert.throws(()=>report(source),/Duplicate supplier cost/);
 source=setup();
 source.costs[0].gross_cents=-1;
 assert.throws(()=>report(source),/Unverified source amount/);
 source=setup();
 source.costs[0].invoice_date='2026-02-30';
 assert.throws(()=>report(source),/Invalid source date/);
 source=setup();
 source.reviews.push({...source.reviews[0]});
 assert.throws(()=>report(source),/Duplicate cost review/);
});

test('Credit notes remain separate and source dates are reflected in their own month',()=>{
 const source=setup();
 source.sales.credit_notes.push({id:'c-2',invoice_id:'missing',issuer_id:'issuer',issued_on:'2026-05-01',gross_cents:1500});
 const r=report(source);
 assert.equal(r.totals.creditsGross,11500);
 assert.equal(r.months[4].creditsGross,1500);
 assert.equal(report(source,{propertyId:ID2}).totals.creditsGross,10000);
 setup();
});

test('New report reads only authenticated entity/year source, preserves other fiscal operations',()=>{
 const page=src('app/admin/workspaces/accountancy/performance/page.tsx');
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(page,/annualSource\(db,chosen\.id\)/);
 assert.match(page,/propertyFinancialReport\(source,\{propertyId:property\|\|undefined,projectId:project\|\|undefined\}\)/);
 assert.match(page,/allRows<Year>/);
 assert.match(page,/scope/);
 assert.match(page,/NOT profit, taxable income, bank cash received/);
 assert.match(page,/only applies entity and year/gi.test(page)?/sales\.toString\(\)/:/sales\.toString\(\)/);
 assert.match(page,/status/gi.test(page)?/role="alert"/:/role="alert"/);
 assert.doesNotMatch(page,/\.insert\(|\.update\(|\.delete\(/);
 assert.match(src('app/admin/workspaces/accountancy/page.tsx'),/href="\/admin\/workspaces\/accountancy\/performance"/);
 assert.match(src('app/admin/workspaces/estates/page.tsx'),/href="\/admin\/workspaces\/accountancy\/performance"/);
});


test('Monthly report export verifies admin scope and uses formula-safe accountant CSV',()=>{
 const route=src('app/admin/workspaces/accountancy/performance/export/route.ts');
 const page=src('app/admin/workspaces/accountancy/performance/page.tsx');
 assert.match(route,/await requireEstateAdmin\(\)/);
 assert.match(route,/annualSource\(db,yearId\)/);
 assert.match(route,/\.eq\('id',yearId\)/);
 assert.match(route,/\.eq\('id',propertyId\)/);
 assert.match(route,/propertyFinancialReport\(source,\{propertyId:propertyId\|\|undefined,projectId:projectId\|\|undefined\}\)/);
 assert.match(route,/const csv=accountantCsv\(fields,rows\)/);
 assert.match(route,/period:'ANNUAL_TOTAL'/);
 assert.match(route,/Cache-Control':'private, no-store'/);
 assert.match(route,/Content-Disposition/);
 assert.match(route,/No partial report exported/);
 assert.doesNotMatch(route,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
 assert.match(page,/exportParams\.set\('property',property\)/);
 assert.match(page,/exportParams\.set\('project',project\)/);
 assert.match(page,/\/admin\/workspaces\/accountancy\/performance\/export\?/);
});
