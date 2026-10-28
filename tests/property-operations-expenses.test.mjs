import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const compiled=ts.transpileModule(readFileSync(new URL('../lib/property-operations/expenses.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const subject={};
vm.runInNewContext(compiled,{exports:subject,Date,Set,Map,BigInt});
const {normalizePurchaseExpense,purchaseExpenseIdentityKey,canApproveSupplierExpense}=subject;

const entity='11111111-1111-4111-8111-111111111111';
const otherEntity='22222222-2222-4222-8222-222222222222';
const supplier='33333333-3333-4333-8333-333333333333';
const p1='44444444-4444-4444-8444-444444444444';
const p2='55555555-5555-4555-8555-555555555555';
const u1='66666666-6666-4666-8666-666666666666';
const u2='77777777-7777-4777-8777-777777777777';
const scope={propertyIds:new Set([p1,p2]),unitProperties:{[u1]:p1,[u2]:p2}};
const base=()=>({
  legalEntityId:entity,supplierRelationshipId:supplier,supplierInvoiceNumber:'  ELEC-2026-110  ',
  invoiceDate:'2026-10-28',dueDate:'2026-11-12',
  servicePeriodStart:'2026-10-01',servicePeriodEnd:'2026-10-27',
  currency:'EUR',sourceSha256:'a'.repeat(64),
  lines:[{category:'electricity',description:'Meter reading October',netCents:10001,vatCents:2100,
    shares:[{propertyId:p1,unitId:u1,basisPoints:3333},{propertyId:p2,unitId:u2,basisPoints:6667}]}]
});
const work=(mutate=()=>{},allowed=scope)=>{const x=base();mutate(x);return normalizePurchaseExpense(x,allowed)};

test('supplier invoice preserves actual dates, legal entity and source evidence',()=>{
 const r=work();
 assert.equal(r.legalEntityId,entity);
 assert.equal(r.supplierRelationshipId,supplier);
 assert.equal(r.supplierInvoiceNumber,'ELEC-2026-110');
 assert.equal(r.invoiceDate,'2026-10-28');
 assert.equal(r.servicePeriodStart,'2026-10-01');
 assert.equal(r.totals.netCents,10001);
 assert.equal(r.totals.vatCents,2100);
 assert.equal(r.totals.grossCents,12101);
 assert.equal(r.requiresDocument,false);
 assert.equal(canApproveSupplierExpense(r),true);
});

test('cent-perfect allocations preserve net/VAT/gross and unit-parent links',()=>{
 const r=work();
 const rows=r.lines[0].allocations;
 assert.equal(rows.reduce((n,x)=>n+x.netCents,0),10001);
 assert.equal(rows.reduce((n,x)=>n+x.vatCents,0),2100);
 assert.equal(rows.reduce((n,x)=>n+x.grossCents,0),12101);
 assert.equal(rows[0].unitId,u1);
 assert.equal(rows[1].propertyId,p2);
 const reversed=work(x=>{x.lines[0].shares.reverse()});
 assert.deepEqual(Object.fromEntries(rows.map(x=>[x.unitId,[x.netCents,x.vatCents]])),
  Object.fromEntries(reversed.lines[0].allocations.map(x=>[x.unitId,[x.netCents,x.vatCents]])));
});

test('duplicate invoice identity is per entity AND supplier, regardless of case and stray spaces',()=>{
 const a=purchaseExpenseIdentityKey(entity,supplier,'  elec-2026-110 ');
 const b=purchaseExpenseIdentityKey(entity,supplier,'ELEC-2026-110');
 assert.equal(a,b);
 assert.notEqual(a,purchaseExpenseIdentityKey(otherEntity,supplier,'ELEC-2026-110'));
 assert.throws(()=>purchaseExpenseIdentityKey('arbitrary',supplier,'ABC'),/legal entity/);
});

test('non-linked property and wrong unit parent are rejected before financial write',()=>{
 assert.throws(()=>work(x=>{x.lines[0].shares=[{propertyId:p2,unitId:u1,basisPoints:10000}]}),/Unit does not belong/);
 assert.throws(()=>work(x=>{x.lines[0].shares=[{propertyId:p2,basisPoints:10000}]},
  {propertyIds:new Set([p1]),unitProperties:scope.unitProperties}),/Property is not approved/);
 assert.throws(()=>work(x=>{x.lines[0].shares=[
  {propertyId:p1,unitId:u1,basisPoints:5000},{propertyId:p1,unitId:u1,basisPoints:5000}
 ]}),/Duplicate cost allocation/);
 assert.throws(()=>work(x=>{x.lines[0].shares=[{propertyId:p1,unitId:u1,basisPoints:9999}]}),/exactly 100%/);
});

test('bad dates, unreviewed currencies, unsupported categories, and fractional cents fail closed',()=>{
 assert.throws(()=>work(x=>{x.invoiceDate='2026-02-30'}),/invoice date/);
 assert.throws(()=>work(x=>{x.servicePeriodEnd='2026-09-20'}),/reversed/);
 assert.throws(()=>work(x=>{x.servicePeriodStart=null}),/together/);
 assert.throws(()=>work(x=>{x.currency='GBP'}),/EUR currency/);
 assert.throws(()=>work(x=>{x.lines[0].category='other-tax-rate'}),/category/);
 assert.throws(()=>work(x=>{x.lines[0].netCents=1.5}),/integer cents/);
 assert.throws(()=>work(x=>{x.lines[0].netCents=0;x.lines[0].vatCents=0}),/Zero-value/);
 assert.throws(()=>work(x=>{x.supplierInvoiceNumber='  \t  '}),/invoice number/);
});

test('drafts lacking an original source file are flagged, never approved',()=>{
 const result=work(x=>{x.sourceSha256=null});
 assert.equal(result.requiresDocument,true);
 assert.equal(canApproveSupplierExpense(result),false);
 assert.throws(()=>work(x=>{x.sourceSha256='not-a-hash'}),/document hash/);
});

test('net and VAT are accepted only as explicit invoice amounts, never inferred from a rate',()=>{
 const r=work(x=>{
   x.lines=[
    {category:'water',description:'Supplier billed no VAT',netCents:10000,vatCents:0,
      shares:[{propertyId:p1,basisPoints:10000}]},
    {category:'cleaning',description:'Supplier charged VAT',netCents:2500,vatCents:525,
      shares:[{propertyId:p2,basisPoints:10000}]}
   ];
 });
 assert.equal(r.totals.netCents,12500);
 assert.equal(r.totals.vatCents,525);
 assert.equal(r.totals.grossCents,13025);
 assert.equal(r.lines[0].allocations[0].vatCents,0);
 assert.equal(r.lines[1].allocations[0].vatCents,525);
});

test('invalid property scopes and empty invoices cannot produce plausible purchase records',()=>{
 assert.throws(()=>normalizePurchaseExpense(base(),null),/scope/);
 assert.throws(()=>work(x=>{x.lines=[]}),/1–60/);
 assert.throws(()=>work(x=>{x.lines[0].shares=[]}),/1–100/);
});
