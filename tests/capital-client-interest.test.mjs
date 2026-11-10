import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {createTranslator} from 'next-intl';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';

function load(path,dependencies={},globals={}){
 const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,Intl,Date,URL,...globals,require:name=>{if(name in dependencies)return dependencies[name];throw Error(name);}});return exports;
}
const allocation=load('lib/capital/interest-allocation.ts');
const {buildClientCapitalSummaries:build,capitalSummaryDay}=load('lib/capital/client-summary.ts',{'./interest-allocation':allocation});
const sample=()=>({summary_version:2,id:'grant-one',label:'Synthetic loan',party_role:'lender',principal:100000,currency:'EUR',annual_rate:8,start_date:'2026-06-15',end_date:'2027-01-15',total_interest_received:4140,total_interest_paid:0,
 interest_schedule:[{id:'sep',due_date:'2026-09-15',amount:2000},{id:'oct',due_date:'2026-10-15',amount:2000},{id:'nov',due_date:'2026-11-15',amount:2000}],
 interest_payments:[{date:'2026-09-18',amount:800,instalment_id:'sep'},{date:'2026-09-29',amount:1190,instalment_id:'sep'},{date:'2026-10-14',amount:2150,instalment_id:'oct'}]});
test('client schedule reconciles cash once and uses the admin allocation for both loan perspectives',()=>{
 for(const party_role of ['lender','borrower']){
  const raw=sample();raw.party_role=party_role;if(party_role==='borrower'){raw.total_interest_paid=raw.total_interest_received;raw.total_interest_received=0;}
  const original=JSON.stringify(raw),d=build([raw],'2026-11-09')[0];
  assert.equal(d.interest.next.due_date,'2026-11-15');assert.equal(d.interest.next.remaining,1860);
  assert.equal(d.interest.remaining,1860);assert.equal(d.interest.terms[0].remaining,0);assert.equal(d.interest.terms[0].credit,10);assert.equal(d.interest.terms[2].credit,140);
  assert.equal(d.interest_payments.reduce((n,p)=>n+Math.round(p.amount*100),0),414000);
  assert.equal(d.interest_payments[0].date,'2026-10-14');assert.equal(JSON.stringify(raw),original);
 }
});
test('empty schedules, all-settled schedules and oldest open instalment are distinct',()=>{
 const raw=sample();raw.interest_payments=[];raw.total_interest_received=0;
 assert.equal(build([raw],'2026-11-09')[0].interest.next.due_date,'2026-09-15');
 raw.interest_schedule=[];let result=build([raw],'2026-11-09')[0];assert.equal(result.interest.terms.length,0);assert.equal(result.interest.next,null);
 const full=sample();full.interest_payments.push({instalment_id:'nov',date:'2026-11-09',amount:1860});full.total_interest_received=6000;
 result=build([full],'2026-11-09')[0];assert.equal(result.interest.next,null);assert.equal(result.interest.remaining,0);
});
test('partial projections and inconsistent cash fail closed; internal fields never reach the client DTO',()=>{
 for(const mutate of [d=>delete d.interest_schedule,d=>delete d.summary_version,d=>d.total_interest_received=0,d=>d.interest_payments[0].instalment_id='other-loan',d=>d.interest_schedule.push(d.interest_schedule[0]),d=>d.interest_schedule[0].amount=null,d=>d.interest_schedule[0].due_date='2026-02-31',d=>d.interest_payments[0].is_void=true]){
  const raw=sample();mutate(raw);assert.throws(()=>build([raw],'2026-11-09'));
 }
 assert.throws(()=>build(null));assert.throws(()=>build([sample(),sample()]));
 const raw=sample();raw.notes='SECRET';raw.borrower='SECRET';raw.interest_payments[0].reference='SECRET';raw.interest_schedule[0].note='SECRET';
 const dto=JSON.stringify(build([raw],'2026-11-09'));assert.ok(!dto.includes('SECRET'));assert.ok(!dto.includes('instalment_id'));assert.ok(!dto.includes('interest_schedule'));
});
test('due-date comparison uses Madrid calendar days through midnight and daylight saving changes',()=>{
 assert.equal(capitalSummaryDay(new Date('2026-11-14T23:30:00Z')),'2026-11-15');
 assert.equal(capitalSummaryDay(new Date('2026-07-14T22:30:00Z')),'2026-07-15');
 assert.equal(capitalSummaryDay(new Date('2026-10-25T22:30:00Z')),'2026-10-25');
});
test('synthetic visual fixture is unavailable on production and mismatched previews',async()=>{
 for(const env of [{VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'},
  {VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'},{}]){
  const {default:Page}=load('app/staging/capital-review/page.tsx',{
   'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},'next-intl':{},
   '../../../i18n/public-routing':{},'../../../lib/capital/client-summary':{},
   '../../private/capital/SummaryCards':{},'../../private/capital/summary.module.css':{},'react/jsx-runtime':jsx
  },{process:{env}});
  await assert.rejects(Page({searchParams:Promise.resolve({})}),/NOT_FOUND/);
 }
});
test('client summary API denies missing identity and never returns partial financial figures',async()=>{
 for(const scenario of ['anonymous','inactive','partial','valid']){
  let rpcCalls=0;
  const {GET}=load('app/api/capital-client-summary/route.ts',{
   'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},
   '../../../lib/security/capital-client-environment':{capitalClientEnvironmentAllowed:()=>true},
   '../../../lib/capital/client-summary':{buildClientCapitalSummaries:build},
   '../../../lib/supabase/server':{createClient:async()=>({
    auth:{getUser:async()=>({data:{user:scenario==='anonymous'?null:{id:'caller'}}})},
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:'client',is_active:scenario!=='inactive'}})})})}),
    rpc:async()=>{rpcCalls++;return {data:scenario==='partial'?[{id:'broken'}]:[sample()]};}
   })}
  });
  const result=await GET();
  assert.equal(result.status,{anonymous:401,inactive:403,partial:503,valid:200}[scenario]);
  assert.equal(rpcCalls,['partial','valid'].includes(scenario)?1:0);
  assert.equal(result.headers['Cache-Control'],'private, no-store, max-age=0');
  if(scenario==='valid')assert.equal(result.body.items[0].interest.next.remaining,1860);
  else assert.equal(result.body.items,undefined);
 }
});
test('all supported languages render balances, credits and payment history without missing messages',()=>{
 const items=build([sample()],'2026-11-09');
 for(const file of readdirSync('messages').filter(f=>f.endsWith('.json'))){
  const locale=file.replace('.json',''),messages=JSON.parse(readFileSync('messages/'+file,'utf8'));const errors=[];
  const t=createTranslator({locale,messages:messages.CapitalUI,onError:e=>errors.push(e)});
  const {default:Cards}=load('app/private/capital/SummaryCards.tsx',{'react/jsx-runtime':jsx,'next-intl':{useLocale:()=>locale,useTranslations:()=>t},'./summary.module.css':{default:{}}});
  for(const value of [items,build([{...sample(),interest_schedule:[],interest_payments:[],total_interest_received:0}],'2026-11-09')]){
   const html=renderToStaticMarkup(jsx.jsx(Cards,{items:value}));assert.ok(html.includes(messages.CapitalUI.schedule_title));assert.ok(html.includes('<details'));assert.ok(!html.includes('NaN'));
  }
  assert.equal(errors.length,0,locale);
 }
});

test('database projection enforces active caller grants, excludes principal/voids/secrets and preserves every scheduled term',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated,anon;
  create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
  create schema storage;create table storage.buckets(id text,name text,public boolean,file_size_limit int,allowed_mime_types text[]);
  create table storage.objects(bucket_id text,name text);
  create table profiles(id uuid primary key,role text,is_active boolean);
  insert into profiles values(md5('client')::uuid,'client',true),(md5('other')::uuid,'client',true),(md5('partner')::uuid,'partner',true),(md5('inactive')::uuid,'client',false),(md5('admin')::uuid,'admin',true);
  grant select on profiles to authenticated;`);
  for(const file of ['20261020061042_private_capital_deals_staging.sql','20261020074520_capital_client_summary_staging.sql','20261025175100_capital_interest_credit_and_correction.sql','20261109230155_capital_client_interest_overview.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
  await db.exec(`insert into mzs_capital_deals(id,title,direction,lender,borrower,principal,annual_rate,notes,source_reference) values(md5('loan')::uuid,'Fixture','provided','SECRET lender','SECRET borrower',100000,8,'SECRET notes','SECRET source'),(md5('other-loan')::uuid,'Other','provided','Other lender','Other borrower',1000,8,'','');
  insert into mzs_capital_instalments(id,deal_id,kind,due_date,amount,note) values(md5('sep')::uuid,md5('loan')::uuid,'interest','2026-09-15',2000,'SECRET term'),(md5('oct')::uuid,md5('loan')::uuid,'interest','2026-10-15',2000,''),(md5('nov')::uuid,md5('loan')::uuid,'interest','2026-11-15',2000,''),(md5('principal')::uuid,md5('loan')::uuid,'principal','2026-11-15',100000,''),(md5('foreign')::uuid,md5('other-loan')::uuid,'interest','2026-11-15',999,'');
  insert into mzs_capital_payments(id,instalment_id,amount,paid_on,reference) values(md5('p1')::uuid,md5('sep')::uuid,800,'2026-09-18','SECRET reference'),(md5('p2')::uuid,md5('sep')::uuid,1190,'2026-09-29','SECRET reference'),(md5('void')::uuid,md5('oct')::uuid,2000,'2026-10-14','SECRET original'),(md5('principal-payment')::uuid,md5('principal')::uuid,100,'2026-10-14','SECRET principal');
  update mzs_capital_payments set is_void=true,void_reason='SECRET correction' where id=md5('void')::uuid;
  insert into mzs_capital_payments(instalment_id,amount,paid_on,reference) values(md5('oct')::uuid,2150,'2026-10-14','SECRET replacement');
  insert into mzs_capital_client_access(deal_id,user_id,party_role,display_label) values(md5('loan')::uuid,md5('client')::uuid,'lender','My loan'),(md5('loan')::uuid,md5('partner')::uuid,'borrower','My loan'),(md5('loan')::uuid,md5('inactive')::uuid,'lender','My loan');`);
  for(const identity of ['client','partner']){
   await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub',md5('${identity}')::uuid::text,false);`);
   const rows=(await db.query('select mzs_my_capital_summaries() as items')).rows[0].items;
   assert.equal(rows.length,1);assert.equal(rows[0].interest_schedule.length,3);assert.equal(rows[0].interest_payments.length,3);assert.ok(!JSON.stringify(rows).includes('SECRET'));
   const [d]=build(rows,'2026-11-09');assert.equal(d.interest.next.remaining,1860);
   assert.equal((await db.query('select count(*)::int as n from mzs_capital_payments')).rows[0].n,0);
  }
  await db.exec("select set_config('request.jwt.claim.sub',md5('other')::uuid::text,false)");assert.equal((await db.query('select mzs_my_capital_summaries() as items')).rows[0].items.length,0);
  await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);update mzs_capital_client_access set is_active=false where user_id=md5('client')::uuid;set role authenticated;select set_config('request.jwt.claim.sub',md5('client')::uuid::text,false)");
  assert.equal((await db.query('select mzs_my_capital_summaries() as items')).rows[0].items.length,0);
  for(const identity of ['inactive','admin']){await db.exec(`select set_config('request.jwt.claim.sub',md5('${identity}')::uuid::text,false)`);await assert.rejects(db.query('select mzs_my_capital_summaries()'),/Active client or partner/);}
  await db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)");await assert.rejects(db.query('select mzs_my_capital_summaries()'),/permission denied/);
 }finally{await db.close();}
});
