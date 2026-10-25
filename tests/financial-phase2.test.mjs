import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const result={};
 vm.runInNewContext(transpiled,{exports:result,require:(id)=>{
  if(id==='./financial-cockpit')return load('lib/finance/financial-cockpit.ts');
  if(id==='../capital/interest-allocation')return load('lib/capital/interest-allocation.ts');
  if(id==='../estates/lease-cashflow')return load('lib/estates/lease-cashflow.ts');
  throw Error('Unexpected test dependency '+id);
 }});
 return result;
}
const {buildFinancialPhase2}=load('lib/finance/financial-report.ts');
const terms={status:'active',first_period:'2026-10-01',lease_start:'2026-10-01',
 lease_end:'2026-12-31',max_terms:null,prorate:false,lines:[{amount:'1200.00',vat:'exempt'}]};
function input(entityId='all'){
 return {
  year:2026,asOf:'2026-10-25',entityId,loansAvailable:true,
  issuers:[{id:'issuer-a',name:'Private landlord',kind:'person'},{id:'issuer-b',name:'Company B',kind:'company'}],
  contracts:[
   {...terms,id:'c-a',issuer_id:'issuer-a'},
   {...terms,id:'c-b',issuer_id:'issuer-b',lines:[{amount:'800.00',vat:'exempt'}]},
   {...terms,id:'c-unassigned',issuer_id:null,lines:[{amount:'300.00',vat:'exempt'}]}
  ],
  invoices:[
   {id:'i-a',contract_id:'c-a',issuer_id:'issuer-a',due_date:'2026-10-15',total:1000},
   {id:'i-b',contract_id:'c-b',issuer_id:'issuer-b',due_date:'2026-11-15',total:500},
   {id:'i-unassigned',contract_id:'c-unassigned',issuer_id:null,due_date:'2026-10-01',total:200}
  ],
  rentPayments:[
   {invoice_id:'i-a',amount:400,received_on:'2026-10-21',reversed_at:null},
   {invoice_id:'i-a',amount:100,received_on:'2026-10-21',reversed_at:'2026-10-22'},
   {invoice_id:'i-b',amount:200,received_on:'2026-10-21',reversed_at:null}
  ],
  deals:[
   {id:'d-given',direction:'provided',status:'active',review_state:'needs_review'},
   {id:'d-received',direction:'received',status:'active',review_state:'reviewed'}
  ],
  instalments:[
   {id:'interest-given',deal_id:'d-given',kind:'interest',due_date:'2026-10-20',amount:100},
   {id:'interest-received',deal_id:'d-received',kind:'interest',due_date:'2026-10-20',amount:60},
   {id:'principal-given',deal_id:'d-given',kind:'principal',due_date:'2026-10-20',amount:2000}
  ],
  loanPayments:[
   {instalment_id:'interest-given',amount:25,paid_on:'2026-10-24',is_void:false},
   {instalment_id:'interest-received',amount:20,paid_on:'2026-10-24',is_void:false}
  ],
  bookings:[{id:'b',status:'confirmed',is_test:false,check_in:'2026-11-10',check_out:'2026-11-12',quoted_total_eur:700}]
 };
}
test('Group report sums contract income and interest without treating booking revenue as additional rent',()=>{
 const d=buildFinancialPhase2(input());
 const oct=d.rows.find(r=>r.month==='2026-10');
 assert.equal(oct.rentForecast,2300);assert.equal(oct.interestIn,100);
 assert.equal(oct.interestOut,60);assert.equal(d.report.expectedNet,2300*3+100-60);
 assert.equal(d.report.recordedNet,400+200+25-20);
 assert.equal(d.bookings.total,700);
 assert.equal(d.report.outstandingRent,600+300+200);
 assert.equal(d.report.overdueRent,600+200);
 assert.equal(d.report.overdueLoanReceivables,75);
 assert.equal(d.report.overdueLoanPayables,40);
});
test('Issuer filters select only referenced contracts and historical issued invoice issuer IDs',()=>{
 const d=buildFinancialPhase2(input('issuer-a'));
 assert.equal(d.rows.find(r=>r.month==='2026-10').rentForecast,1200);
 assert.equal(d.rows.find(r=>r.month==='2026-10').rentReceived,400);
 assert.equal(d.rows.find(r=>r.month==='2026-10').interestIn,0);
 assert.equal(d.bookings.total,0);
 assert.equal(d.report.outstandingRent,600);
 assert.equal(d.report.overdueRent,600);
 assert.equal(d.report.overdueLoanReceivables,0);
 assert.equal(d.entities.find(e=>e.id==='issuer-a').kind,'person');
});
test('Unassigned group retains unlinked sources and does not guess the legal entity from names',()=>{
 const d=buildFinancialPhase2(input('unassigned'));
 assert.equal(d.rows.find(r=>r.month==='2026-10').rentForecast,300);
 assert.equal(d.rows.find(r=>r.month==='2026-10').interestIn,100);
 assert.equal(d.bookings.total,700);
 assert.equal(d.report.unassignedContracts,1);
 assert.equal(d.report.outstandingRent,200);
 assert.equal(d.report.loanAttributionPending,2);
 assert.equal(d.report.bookingAttributionPending,1);
});
test('Unknown entity fails closed; reversed payments are excluded',()=>{
 assert.throws(()=>buildFinancialPhase2(input('not-in-register')),/Unknown financial entity/);
 const d=buildFinancialPhase2(input('issuer-a'));
 assert.equal(d.report.recordedNet,400);
});

test('Agreed loan with real non-void interest payments counts toward cash and overdue ledger',()=>{
 const item=input();
 item.deals[0].status='agreed';
 const d=buildFinancialPhase2(item);
 const oct=d.rows.find(r=>r.month==='2026-10');
 assert.equal(oct.interestIn,100);
 assert.equal(oct.interestReceived,25);
 assert.equal(d.report.overdueLoanReceivables,75);
});

test('Loan interest is attributed only to its explicit person/company issuing entity',()=>{
 const item=input();
 item.deals[0].entity_id='issuer-a';
 item.deals[1].entity_id='issuer-b';
 const person=buildFinancialPhase2({...item,entityId:'issuer-a'});
 const company=buildFinancialPhase2({...item,entityId:'issuer-b'});
 const unassigned=buildFinancialPhase2({...item,entityId:'unassigned'});
 const group=buildFinancialPhase2(item);
 assert.equal(person.rows.find(r=>r.month==='2026-10').interestIn,100);
 assert.equal(person.rows.find(r=>r.month==='2026-10').interestReceived,25);
 assert.equal(person.rows.find(r=>r.month==='2026-10').interestOut,0);
 assert.equal(company.rows.find(r=>r.month==='2026-10').interestPaid,20);
 assert.equal(unassigned.rows.find(r=>r.month==='2026-10').interestReceived,0);
 assert.equal(group.rows.find(r=>r.month==='2026-10').interestReceived,25);
 assert.equal(group.rows.find(r=>r.month==='2026-10').interestPaid,20);
 assert.equal(group.report.loanAttributionPending,0);
});
