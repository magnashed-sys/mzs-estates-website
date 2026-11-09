import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const src=path=>readFileSync(new URL(path,root),'utf8');
const compile=path=>ts.transpileModule(src(path),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const pricing={};
vm.runInNewContext(compile('lib/estates/lease-pricing.ts'),{exports:pricing});
const functions={};
vm.runInNewContext(compile('lib/estates/active-lease-value.ts'),{exports:functions,require:()=>pricing});
const value=functions.activeLeaseValue;
const contract=(id,lines,more={})=>({
  id,status:'active',lease_start:'2026-11-01',lease_end:null,pricing_basis:'all_in',
  lines:lines.map(amount=>({description:'Monthly',amount,vat:'0'})),...more,
});

test('active contracts count only once, future and expired contracts are excluded',()=>{
  const data=[
    contract('current',['675.00']),contract('multiunit',['500','500']),
    contract('future',['2000'],{lease_start:'2027-01-01'}),
    contract('ended',['600'],{lease_end:'2026-11-08'}),
    contract('stopped',['10000'],{status:'stopped'}),
  ];
  const x=value(data,[],'2026-11-09');
  assert.equal(x.activeContracts,2);
  assert.equal(x.monthlyCents,167500);
  assert.equal(x.annualizedCents,2010000);
  assert.equal(x.complete,true);
});

test('approved effective indexations replace base amounts; future and proposed changes do not apply',()=>{
  const c=contract('a',['100.00']);
  const adjustment=(revision,amount,effective_on,status='approved')=>({
    id:String(revision),contract_id:'a',revision,kind:'indexation',effective_on,status,
    base_lines:c.lines,new_lines:[{amount,description:'Rent',vat:'0'}],
    calculation:{},evidence:'fixture',approved_at:null,created_at:'2026-01-01',
  });
  const result=value([c],[
    adjustment(1,'108.00','2026-11-01'),
    adjustment(2,'115.00','2026-12-01'),
    adjustment(3,'999.00','2026-11-01','proposed'),
  ],'2026-11-09');
  assert.equal(result.monthlyCents,10800);
  assert.equal(result.annualizedCents,129600);
});

test('unclassified monthly charges are included but disclosed by counter',()=>{
  const rows=[contract('unclassified',['550.00','50.00'],{pricing_basis:'unclassified'}),
    contract('separate',['753.43','50.00','753.43','50.00'],{pricing_basis:'separate'})];
  const s=value(rows,[],'2026-11-09');
  assert.equal(s.unclassifiedContracts,1);
  assert.equal(s.monthlyCents,220686);
  assert.equal(s.annualizedCents,2648232);
});

test('missing amounts, malformed amounts and duplicate contracts never produce a validated total',()=>{
  for(const row of [
    contract('missing',[]),
    contract('invalid',['foo']),
    contract('precision',['13.123']),
    contract('negative',['-4.00'])
  ])assert.equal(value([row],[],'2026-11-09').complete,false);
  assert.equal(value([contract('duplicate',['20']),contract('duplicate',['20'])],[],'2026-11-09').complete,false);
  assert.equal(value([contract('future',['2000'],{lease_start:'2027-01-01'})],[],'2026-11-09').monthlyCents,0);
});

test('Real Estate dashboard sources both complete registers behind the admin guard',()=>{
  const page=src('app/admin/workspaces/estates/page.tsx');
  assert.match(page,/await requireEstateAdmin\(\)/);
  assert.match(page,/readRegister\(db,'mzs_lease_contracts'\)/);
  assert.match(page,/readRegister\(db,'mzs_lease_adjustments'\)/);
  assert.match(page,/activeLeaseValue\(contractRegister\.data,adjustmentRegister\.data,today\)/);
  assert.match(page,/rentAvailable\?asEuros\(snapshot!\.monthlyCents\):adminT\('Unavailable'\)/);
  assert.match(page,/rentAvailable\?asEuros\(snapshot!\.annualizedCents\):adminT\('Unavailable'\)/);
  assert.match(page,/Some contracts have no confirmed rent\/advance breakdown/);
  assert.match(page,/not a forecast or received payments/);
});

test('Estate detail CSS stays light without changing shared header',()=>{
  const css=[
    'app/admin/group/estates/properties/estates.module.css',
    'app/admin/workspaces/estates/operations/operations.module.css',
    'app/admin/workspaces/estates/entities/entities.module.css',
    'app/admin/workspaces/estates/expenses/expenses.module.css',
  ];
  for(const file of css){
    const content=src(file);
    for(const old of ['#151411','#16140f','#171510','#181715','#17150f','#262219'])
      assert.ok(!content.includes(old),file+' retains dark surface '+old);
  }
  assert.match(src('app/admin/layout.tsx'),/<AdminHeader\/><div className="admin-light-content">/);
});


test('Real Estate register lists are ordered alphabetically by address',()=>{
  const properties=src('app/admin/group/estates/properties/page.tsx');
  const units=src('app/admin/group/estates/units/page.tsx');
  assert.match(properties,/\.order\('address', \{ ascending: true \}\)/);
  assert.match(units,/\.order\('address'\)\.order\('sort_order'\)/);
});
