import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const lib={};vm.runInNewContext(compile('lib/property-operations/expense-register.ts'),{exports:lib,URLSearchParams});
const {expenseFilters,expenseRegisterHref,expensePageTotals}=lib;
test('expense filters validate identity and dates, strip query syntax and preserve paging filters',()=>{
 assert.throws(()=>expenseFilters({property:'not-an-id'}),/filter/);
 assert.throws(()=>expenseFilters({from:'2026-02-30'}),/datum/);
 assert.throws(()=>expenseFilters({from:'2026-10-20',until:'2026-10-01'}),/einddatum/);
 const f=expenseFilters({q:'onderhoud,()%_"\\',page:'9',from:'2026-01-01'});
 assert.equal(f.q,'onderhoud');assert.equal(f.page,9);
 assert.match(expenseRegisterHref(f,8),/q=onderhoud&from=2026-01-01&page=8#expense-register$/);
 assert.equal(expenseFilters({page:'Infinity'}).page,1);
});
test('page totals reconcile exact cents and reject malformed amounts',()=>{
 const x=expensePageTotals([{net_cents:101,vat_cents:21,gross_cents:122},{net_cents:99,vat_cents:0,gross_cents:99}]);
 assert.equal(x.net,200);assert.equal(x.vat,21);assert.equal(x.gross,221);
 assert.throws(()=>expensePageTotals([{net_cents:101,vat_cents:21,gross_cents:121}]),/betrouwbaar/);
 assert.throws(()=>expensePageTotals([{net_cents:'101',vat_cents:21,gross_cents:122}]),/betrouwbaar/);
});
async function renderRegister(pageNumber,count=201){
 const calls=[];const selections=[];
 const db={from(table){
  selections.push(table);let first=0,last=24;
  const builder={select(){return builder},order(column){calls.push(['order',table,column]);return builder},limit(){return builder},eq(){return builder},gte(){return builder},lte(){return builder},or(){return builder},range(a,b){first=a;last=b;calls.push(['range',a,b]);return builder},then(resolve){
   if(table==='mzs_ops_expense_drafts'&&first>0&&first>=count)return Promise.resolve({error:{code:'PGRST103'},count:null,data:null}).then(resolve);
   const data=table==='mzs_ops_expense_drafts'?Array.from({length:Math.min(last-first+1,Math.max(0,count-first))},(_,i)=>({id:String(first+i),net_cents:100,vat_cents:21,gross_cents:121,status:'draft',source_document_status:'missing'})):[];
   return Promise.resolve({error:null,count:table==='mzs_ops_expense_drafts'?count:0,data}).then(resolve);
  }};return builder;
 }};
 const e={};let authorized=false;
 vm.runInNewContext(compile('app/admin/workspaces/estates/expenses/page.tsx'),{exports:e,process:{env:{VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'}},require(name){
  if(name==='react/jsx-runtime')return require(name);
  if(name==='next/navigation')return {notFound(){throw Error('not-found')},redirect(url){throw Error('redirect:'+url)}};
  if(name.includes('security/estate-properties'))return {requireEstateAdmin:async()=>{authorized=true;return {db}}};
  if(name.includes('expense-register'))return lib;
  return {default:()=>null};
 }});
 const result=await e.default({searchParams:Promise.resolve({page:String(pageNumber)})});
 return {result,calls,selections,authorized};
}
test('server register renders beyond the old 200-row ceiling using bounded, stable pages',async()=>{
 const x=await renderRegister(9);
 assert.equal(x.authorized,true);
 assert.ok(x.calls.some(c=>c[0]==='range'&&c[1]===200&&c[2]===224));
 assert.ok(x.calls.some(c=>c[0]==='order'&&c[1]==='mzs_ops_expense_drafts'&&c[2]==='id'));
 assert.ok(x.result);
});
test('PostgREST 416 without count recovers the final page instead of losing register access',async()=>{
 await assert.rejects(renderRegister(10),/redirect:.*page=9/);
});
