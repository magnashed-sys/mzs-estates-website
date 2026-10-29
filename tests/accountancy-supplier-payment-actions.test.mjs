import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const year=id(1),draft=id(2),issuer=id(3),payment=id(4),req=id(5);
const path='app/admin/workspaces/accountancy/administrations/[id]/payments/actions.ts';
const moduleSource=ts.transpileModule(readFileSync(path,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function harness({enabled=true,mode='synthetic',allowed=true,matchingYear=true,rpcError=null}={}){
 const calls=[],result={},auth=()=>{calls.push('auth');if(!allowed)throw Error('Access denied');return {db};};
 const db={
  from(table){
   calls.push('from:'+table);
   return {
    select(){return this;},
    eq(){return this;},
    async single(){
     if(table==='mzs_accountancy_years')return {data:{issuer_id:issuer,fiscal_year:2026},error:null};
     if(table==='mzs_ops_expense_drafts')return {data:{legal_entity_id:matchingYear?issuer:id(9),invoice_date:'2026-10-29'},error:null};
     throw Error('Unexpected query');
    }
   };
  },
  async rpc(name,args){calls.push(['rpc',name,args]);return {error:rpcError?{message:rpcError}:null};}
 };
 vm.runInNewContext(moduleSource,{
  exports:result,FormData,
  require(name){
   if(name==='next/cache')return {revalidatePath:p=>calls.push(['refresh',p])};
   if(name==='next/navigation')return {notFound(){calls.push('notFound');throw Error('Not Found');}};
   if(name.includes('security/estate-properties'))return {requireEstateAdmin:auth};
   if(name.includes('accountancy/supplier-payments'))return {supplierPaymentMode:()=>enabled?mode:null};
   if(name.includes('accountancy/administration'))return {
    uuid:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    ADMINISTRATION_ROOT:'/admin/workspaces/accountancy/administrations',
    dateValue:d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('invalid');return d;}
   };
   if(name.includes('property-operations/expense-preview'))return {inputEuroCents:str=>{
    if(!/^\d+(?:\.\d{1,2})?$/.test(str))throw Error('invalid');
    return Math.round(Number(str)*100);
   }};
   throw Error('Unexpected dependency '+name);
  }
 });
 return {actions:result,calls};
}
function request(overrides={}){
 const values={request_id:req,draft_id:draft,year_id:year,amount_eur:'0.50',
 paid_on:'2026-10-29',reference:'SYNTHETIC-REFERENCE',confirmed_synthetic_staging_test:'yes',...overrides};
 const form=new FormData();
 for(const [key,value] of Object.entries(values))if(value!==null)form.set(key,value);
 return form;
}
test('disabled pilot refuses calls before user auth or any database read',async()=>{
 const x=harness({enabled:false});
 await assert.rejects(x.actions.recordSupplierPayment(request()),/Not Found/);
 assert.deepEqual(x.calls,['notFound']);
});
test('a non-admin cannot call payment actions and cannot reach the write RPC',async()=>{
 const x=harness({allowed:false});
 await assert.rejects(x.actions.recordSupplierPayment(request()),/Access denied/);
 assert.deepEqual(x.calls,['auth']);
});
test('no existing-transfer confirmation means no payment is registered',async()=>{
 const x=harness();
 const reply=await x.actions.recordSupplierPayment(request({confirmed_synthetic_staging_test:null}));
 assert.deepEqual(JSON.parse(JSON.stringify(reply)),{ok:false,code:'invalid'});
 assert.deepEqual(x.calls,['auth']);
});
test('old real-transfer checkbox cannot authorize synthetic staging events',async()=>{
 const x=harness();
 const result=await x.actions.recordSupplierPayment(request({
  confirmed_synthetic_staging_test:null,confirmed_existing_transfer:'yes'
 }));
 assert.equal(result.ok,false);
 assert.equal(result.code,'invalid');
 assert.equal(x.calls.some(c=>Array.isArray(c)&&c[0]==='rpc'),false);
});
test('real Production mode explicitly requires prior-payment confirmation, never a synthetic checkbox',async()=>{
 const missing=harness({mode:'real'});
 const bad=await missing.actions.recordSupplierPayment(request());
 assert.equal(bad.ok,false);
 assert.equal(bad.code,'invalid');
 assert.equal(missing.calls.some(x=>Array.isArray(x)&&x[0]==='rpc'),false);
 const real=harness({mode:'real'});
 const yes=await real.actions.recordSupplierPayment(request({
  confirmed_synthetic_staging_test:null,confirmed_existing_transfer:'yes'
 }));
 assert.equal(yes.ok,true);
 assert.equal(real.calls.filter(x=>Array.isArray(x)&&x[0]==='rpc').length,1);
 const forged=harness({mode:'real'});
 const nope=await forged.actions.recordSupplierPayment(request({confirmed_existing_transfer:'yes'}));
 assert.equal(nope.ok,false);
 assert.equal(forged.calls.some(x=>Array.isArray(x)&&x[0]==='rpc'),false);
});
test('invalid amount and mismatched year or entity are rejected before RPC',async()=>{
 const bad=harness();
 assert.equal((await bad.actions.recordSupplierPayment(request({amount_eur:'-0.50'}))).code,'invalid');
 assert.equal(bad.calls.some(x=>Array.isArray(x)&&x[0]==='rpc'),false);
 const wrong=harness({matchingYear:false});
 assert.equal((await wrong.actions.recordSupplierPayment(request())).code,'invalid');
 assert.equal(wrong.calls.some(x=>Array.isArray(x)&&x[0]==='rpc'),false);
});
test('valid payment confirmation and scoped annual invoice reach the vetted RPC exactly once',async()=>{
 const x=harness();
 const r=await x.actions.recordSupplierPayment(request());
 assert.equal(r.ok,true);
 const calls=x.calls.filter(c=>Array.isArray(c)&&c[0]==='rpc');
 assert.equal(calls.length,1);
 assert.equal(calls[0][1],'mzs_record_supplier_payment');
 assert.equal(calls[0][2].p_amount_cents,50);
 assert.equal(calls[0][2].p_draft,draft);
 assert.equal(x.calls.filter(c=>Array.isArray(c)&&c[0]==='refresh').length,2);
});
test('duplicate references are errors, never silent success or a second write',async()=>{
 const x=harness({rpcError:'An active payment with this reference exists for this invoice'});
 const r=await x.actions.recordSupplierPayment(request());
 assert.equal(r.ok,false);
 assert.equal(r.code,'duplicate');
 assert.equal(x.calls.filter(c=>Array.isArray(c)&&c[0]==='rpc').length,1);
});
test('reversal requires reason and authenticated admin; successful reversal uses immutable RPC',async()=>{
 const x=harness();
 const f=new FormData();
 f.set('payment_id',payment);f.set('draft_id',draft);f.set('year_id',year);
 f.set('reason','short');
 assert.equal((await x.actions.reverseSupplierPayment(f)).code,'invalid');
 f.set('reason','Incorrect synthetic payment registration');
 assert.equal((await x.actions.reverseSupplierPayment(f)).ok,true);
 const calls=x.calls.filter(c=>Array.isArray(c)&&c[0]==='rpc');
 assert.equal(calls.length,1);
 assert.equal(calls[0][1],'mzs_reverse_supplier_payment');
 assert.equal(calls[0][2].p_id,payment);
});
