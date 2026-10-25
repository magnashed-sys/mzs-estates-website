import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=path=>{
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const target={};
 vm.runInNewContext(output,{exports:target,require:(id)=>{
  if(id==='../estates/lease-cashflow')return load('lib/estates/lease-cashflow.ts');
  throw new Error('Unexpected dependency '+id);
 }});
 return target;
};
const {buildFinancialCockpit}=load('lib/finance/financial-cockpit.ts');
const activeLease={
 status:'active',first_period:'2026-10-01',lease_start:'2026-10-01',
 lease_end:'2026-12-31',max_terms:null,prorate:false,
 lines:[{amount:'1200.00',vat:'exempt'}]
};
const loanDeals=[
 {id:'given',direction:'provided',status:'active',review_state:'needs_review'},
 {id:'borrowed',direction:'received',status:'active',review_state:'reviewed'},
 {id:'draft',direction:'provided',status:'draft',review_state:'reviewed'}
];
const instalments=[
 {id:'inc',deal_id:'given',kind:'interest',due_date:'2026-10-31',amount:100},
 {id:'out',deal_id:'borrowed',kind:'interest',due_date:'2026-10-31',amount:60},
 {id:'principal',deal_id:'given',kind:'principal',due_date:'2026-10-31',amount:5000},
 {id:'draft-interest',deal_id:'draft',kind:'interest',due_date:'2026-10-31',amount:300}
];
function model(bookings){
 return buildFinancialCockpit({
  year:2026,asOf:'2026-10-25',
  contracts:[activeLease],rentPayments:[{amount:1200,received_on:'2026-10-29',reversed_at:null},{amount:90,received_on:'2026-10-29',reversed_at:'2026-10-30'}],
  deals:loanDeals,instalments,loanPayments:[{instalment_id:'inc',amount:50,paid_on:'2026-11-02',is_void:false},{instalment_id:'inc',amount:10,paid_on:'2026-11-04',is_void:true},{instalment_id:'principal',amount:5000,paid_on:'2026-11-03',is_void:false}],
  bookings,loansAvailable:true
 });
}
test('Only active lease schedules and interest instalments appear; principal never counted as income',()=>{
 const data=model([]);
 const october=data.rows.find(x=>x.month==='2026-10');
 assert.equal(october.rentForecast,1200);
 assert.equal(october.rentReceived,1200);
 assert.equal(october.interestIn,100);
 assert.equal(october.interestOut,60);
 assert.equal(data.rows.find(x=>x.month==='2026-11').interestReceived,50);
 assert.equal(data.quality.loansNeedingReview,1);
 assert.equal(data.quality.interestEntries,2);
 assert.equal(data.quality.actualLoanPayments,1);
 assert.equal(data.rows.find(x=>x.month==='2026-11').interestIn,0);
});
test('Confirmed stay is prorated by nights across two calendar months; test and cancelled bookings are ignored',()=>{
 const bookings=[
  {id:'yes',status:'confirmed',is_test:false,check_in:'2026-10-30',check_out:'2026-11-03',quoted_total_eur:400},
  {id:'test',status:'confirmed',is_test:true,check_in:'2026-10-30',check_out:'2026-11-03',quoted_total_eur:4000},
  {id:'cancelled',status:'cancelled',is_test:false,check_in:'2026-10-30',check_out:'2026-11-03',quoted_total_eur:5000},
  {id:'missing',status:'confirmed',is_test:false,check_in:'2026-11-07',check_out:'2026-11-09',quoted_total_eur:null}
 ];
 const b=model(bookings).bookings;
 assert.equal(b.confirmed,2); assert.equal(b.unpriced,1);
 assert.equal(b.months.find(x=>x.month==='2026-10').total,200);
 assert.equal(b.months.find(x=>x.month==='2026-11').total,200);
 assert.equal(b.total,400);
});
test('Stay partially before today only includes future booked nights',()=>{
 const b=model([{id:'cross',status:'confirmed',is_test:false,check_in:'2026-10-22',check_out:'2026-10-27',quoted_total_eur:500}]).bookings;
 assert.equal(b.total,200);
});
test('Invalid money values fail closed instead of showing plausible totals',()=>{
 assert.throws(()=>model([{id:'bad',status:'confirmed',is_test:false,check_in:'2026-11-01',check_out:'2026-11-02',quoted_total_eur:'bad'}]),/Invalid recorded monetary amount/);
});
