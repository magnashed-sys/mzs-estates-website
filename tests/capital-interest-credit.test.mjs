import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file=readFileSync(new URL('../lib/capital/interest-allocation.ts',import.meta.url),'utf8');
const output=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(output,{exports});
const {allocateInterestCredits}=exports;
function loan(received=50537.20){
 const entries=[
  {id:'september',kind:'interest',due_date:'2026-09-15',amount:150000},
  {id:'october',kind:'interest',due_date:'2026-10-15',amount:50000},
  {id:'november',kind:'interest',due_date:'2026-11-15',amount:50000},
  {id:'december',kind:'interest',due_date:'2026-12-15',amount:50000},
  {id:'principal',kind:'principal',due_date:'2026-12-15',amount:750000}
 ];
 const payments=[
  {instalment_id:'september',amount:103890.60,is_void:false},
  {instalment_id:'september',amount:46007.51,is_void:false},
  {instalment_id:'october',amount:50000,is_void:true},
  {instalment_id:'october',amount:received,is_void:false}
 ];
 return allocateInterestCredits(entries,payments);
}
test('Aaron Jacob: actual 50537.20 replaces the void 50000, first clears 101.89 prior shortfall, then reduces November by 435.31',()=>{
 const l=loan(),j=l.byId.get('september'),o=l.byId.get('october'),n=l.byId.get('november');
 assert.equal(l.confirmedCash,200435.31);
 assert.equal(l.totalScheduled,300000);
 assert.equal(j.directPaid,149898.11);
 assert.equal(j.creditApplied,101.89);
 assert.equal(j.remaining,0);
 assert.equal(o.directPaid,50537.20);
 assert.equal(o.excessFromThisTerm,537.20);
 assert.equal(o.creditDistributed,537.20);
 assert.equal(o.remaining,0);
 assert.equal(n.creditApplied,435.31);
 assert.equal(n.remaining,49564.69);
 assert.equal(l.byId.get('december').remaining,50000);
 assert.equal(l.unappliedCredit,0);
 assert.equal(l.credits.map(c=>c.amount).join(','),'101.89,435.31');
});
test('Earlier shortfall is still due when the actual receipt is only 50000',()=>{
 const l=loan(50000);
 assert.equal(l.byId.get('september').remaining,101.89);
 assert.equal(l.byId.get('november').remaining,50000);
});
test('Voided original never counts as duplicate cash; principal is not an interest source or target',()=>{
 const l=loan();
 assert.equal(l.rows.length,4);
 assert.ok(!l.byId.has('principal'));
 assert.equal(l.credits.reduce((a,c)=>a+c.amount,0),537.20);
});
test('Receipt excess can be credited to a future third instalment if nearest is already fully paid',()=>{
 const l=allocateInterestCredits(
  [{id:'past',kind:'interest',due_date:'2026-01-01',amount:100},
   {id:'now',kind:'interest',due_date:'2026-02-01',amount:100},
   {id:'future',kind:'interest',due_date:'2026-03-01',amount:100}],
  [{instalment_id:'past',amount:100,is_void:false},
   {instalment_id:'now',amount:150,is_void:false}]);
 assert.equal(l.byId.get('future').remaining,50);
});
test('Tampered non-currency values fail closed',()=>{
 assert.throws(()=>allocateInterestCredits([{id:'x',kind:'interest',due_date:'2026-01-01',amount:50.003}],[]),/Invalid interest amount/);
});
