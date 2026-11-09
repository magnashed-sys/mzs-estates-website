import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function compile(path,imports={}){
 const output=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(output,{exports,require:(id)=>{if(!(id in imports))throw Error('Unexpected import '+id);return imports[id];}});
 return exports;
}
const evidence=compile('lib/accountancy/annual-evidence.ts');
const controls=compile('lib/accountancy/invoice-control.ts');
let income=[];
const bankModel={remaining:(tx,rows)=>Math.abs(tx.amount_cents)-rows.filter(a=>a.transaction_id===tx.id&&!a.reversed_at).reduce((v,a)=>v+Math.abs(a.amount_cents),0)};
const model=compile('lib/accountancy/month-close-readiness.ts',{
 './annual-evidence':evidence,'./invoice-control':controls,
 './cost-centers':{yearIncome:()=>income},'./bank/model':bankModel,
});
const run=model.monthCloseReadiness;
const ISSUER='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
function invoice(id,more={}){return {
 id,source:'rental',issuerId:ISSUER,issuedOn:'2026-11-02',gross:100000,paid:40000,balance:60000,
 dueOn:'2026-11-07',number:'INV'+id,customer:'Tenant',issuer:'MZS',subject:'Rental',
 paymentBasis:'receipt_register',alsoImported:false,href:'/admin/sales',...more
};}
function fixture(){
 income=[
 {invoice_id:'lease1',allocation:undefined,invoice_date:'2026-11-02',gross_cents:100000},
 {invoice_id:'lease2',allocation:{property_id:OTHER,project_id:null},invoice_date:'2026-11-04',gross_cents:200000},
 {invoice_id:'oct1',allocation:undefined,invoice_date:'2026-10-01',gross_cents:50000},
 ];
 const cost=(id,supplier)=>({
  id,legal_entity_id:ISSUER,supplier_relationship_id:supplier,
  supplier_invoice_number:'BILL123456',supplier_name:'Supplier',
  invoice_date:'2026-11-10',gross_cents:12500,
  source_document_status:'missing',archive_documents:[],
 });
 return {
  administration:{fiscal_year:2026,issuer_id:ISSUER,checks:{income:true,costs:false,bank:false,assets:false,financing:false,tax:false,documents:true}},
  costs:[cost('a','supplier-one'),cost('b','supplier-two'),{...cost('c','supplier-three'),invoice_date:'2026-10-25'}],
  reviews:[{draft_id:'a',review_status:'reviewed'},{draft_id:'b',review_status:'pending'}]
 };
}
function bank(){
 return {
  issuer_id:ISSUER,year:2026,accounts:[{id:'bank'}],batches:[],
  transactions:[
   {id:'t1',booked_on:'2026-11-04',amount_cents:50000,voided_at:null},
   {id:'t2',booked_on:'2026-11-05',amount_cents:-30000,voided_at:null},
   {id:'old',booked_on:'2026-10-05',amount_cents:10000,voided_at:null},
   {id:'void',booked_on:'2026-11-05',amount_cents:90000,voided_at:'2026-11-09'}
  ],
  allocations:[
   {transaction_id:'t1',amount_cents:20000,reversed_at:null},
   {transaction_id:'t2',amount_cents:30000,reversed_at:null},
   {transaction_id:'t1',amount_cents:20000,reversed_at:'2026-11-10'}
  ]
 };
}
test('Monthly review separates current invoice balances, not historical cash or certified year-end profit',()=>{
 const source=fixture();
 const invoices=[
  invoice('one'),
  invoice('unknown',{id:'two',paid:null,balance:null,dueOn:null}),
  invoice('credit',{id:'credit',source:'credit',gross:-10000,paid:0,balance:-10000}),
  invoice('archive',{id:'archive',source:'archive',gross:800000,paid:0,balance:800000}),
  invoice('other',{id:'other',issuerId:OTHER,gross:300000,paid:0,balance:300000}),
  invoice('oct',{id:'oct',issuedOn:'2026-10-02'})
 ];
 const x=run(source,invoices,'2026-11','2026-11-09',bank());
 assert.equal(x.month,'2026-11');
 assert.equal(x.invoices.count,3);
 assert.equal(x.invoices.unknownBalances,1);
 assert.equal(x.invoices.unpaidCount,1);
 assert.equal(x.invoices.outstandingCents,60000);
 assert.equal(x.invoices.overdueCents,60000);
 assert.equal(x.invoices.receivedRecordedCents,40000);
 assert.equal(x.purchases.count,2);
 assert.equal(x.purchases.missingOriginals,2);
 assert.equal(x.purchases.pendingReview,1);
 assert.equal(x.purchases.duplicateSignals,2);
 assert.equal(x.purchases.grossConceptCents,25000);
 assert.equal(x.allocations.unallocatedInvoices,1);
 assert.equal(x.allocations.unallocatedGrossCents,100000);
 assert.equal(x.bank.status,'available');
 assert.equal(x.bank.transactionCount,2);
 assert.equal(x.bank.unallocatedTransactions,1);
 assert.equal(x.bank.unallocatedAbsoluteCents,30000);
 assert.equal(x.checklist.completed,2);
 assert.equal(x.checklist.total,7);
});

test('Missing bank data stays explicitly unavailable, not zero or reconciled',()=>{
 const x=run(fixture(),[invoice('one')],'2026-11','2026-11-09',null);
 assert.equal(x.bank.status,'unavailable');
 assert.equal(x.bank.unallocatedTransactions,null);
 assert.equal(x.bank.unallocatedAbsoluteCents,null);
 assert.equal(x.invoices.outstandingCents,60000);
});

test('Bank ownership, overallocated transfers and invalid financial periods fail closed',()=>{
 const s=fixture();
 assert.throws(()=>run(s,[],'2027-11','2026-11-09',null),/Invalid reporting period/);
 assert.throws(()=>run(s,[],'2026-13','2026-11-09',null),/Invalid reporting period/);
 assert.throws(()=>run(s,[],'2026-11','2026-11-09',{...bank(),issuer_id:OTHER}),/outside selected administration/);
 const over=bank();over.allocations.push({transaction_id:'t1',amount_cents:90000,reversed_at:null});
 assert.throws(()=>run(s,[],'2026-11','2026-11-09',over),/Invalid bank allocation remaining amount/);
});

test('Duplicate invoices and corrupt amounts are refused rather than displayed as partial totals',()=>{
 const s=fixture(),r=invoice('one');
 assert.throws(()=>run(s,[r,r],'2026-11','2026-11-09',null),/Duplicate month-close invoice/);
 assert.throws(()=>run(s,[invoice('invalid',{balance:NaN})],'2026-11','2026-11-09',null),/Unverified month-close source amount/);
 assert.throws(()=>run(s,[invoice('bad',{paid:-10})],'2026-11','2026-11-09',null),/Unverified month-close source amount/);
});

test('Protected month-close dashboard only reads complete, original financial sources',()=>{
 const page=read('app/admin/workspaces/accountancy/month-close/page.tsx');
 const model=read('lib/accountancy/month-close-readiness.ts');
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(page,/annualSource\(db,chosen\.id\)/);
 assert.match(page,/loadInvoiceRegister\(db,chosen\.fiscal_year\)/);
 assert.match(page,/bankSource\(db,chosen\.id\)/);
 assert.match(page,/monthCloseReadiness\(annual,invoices,yearMonth,today,bank\)/);
 assert.match(page,/Bank register could not be loaded/);
 assert.match(page,/not the historic month end/);
 assert.match(page,/No period is locked or automatically closed/);
 assert.match(page,/links/i.test(page)?/\/admin\/workspaces\/accountancy\/performance/:/performance/);
 assert.match(read('app/admin/workspaces/accountancy/page.tsx'),/href="\/admin\/workspaces\/accountancy\/month-close"/);
 assert.doesNotMatch(page,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(['"].*issue/i);
 assert.doesNotMatch(model,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});
