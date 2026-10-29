import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(p){p=path.resolve(p);if(cache.has(p))return cache.get(p);const exports={};cache.set(p,exports);vm.runInNewContext(compile(p),{exports,Date,Intl,URLSearchParams,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(p),n)+'.ts'):require(n)});return exports;}
const lib=load('lib/finance/receivables.ts');
const row={id:'a',source:'service',issuerId:'one',issuer:'Private issuer',number:'TEST-1',customer:'Same name',customerId:'customer',issuedOn:'2026-01-01',dueOn:'2026-10-01',gross:12100,paid:0,balance:12100};
test('aging uses calendar days, exact boundary buckets and separate unknown/undated/credits',()=>{
 for(const [due,age] of [['2026-10-30','current'],['2026-10-29','current'],['2026-10-28','days30'],['2026-09-29','days30'],['2026-09-28','days60'],['2026-08-30','days60'],['2026-08-29','days90'],['2026-07-31','days90'],['2026-07-30','older'],[null,'undated']])assert.equal(lib.aging({...row,dueOn:due},'2026-10-29'),age);
 assert.equal(lib.aging({...row,balance:null},'2026-10-29'),'unknown');assert.equal(lib.aging({...row,balance:-1},'2026-10-29'),'credit');assert.equal(lib.aging({...row,balance:0},'2026-10-29'),'settled');assert.throws(()=>lib.aging({...row,dueOn:'2026-02-30'},'2026-10-29'));
});
test('customer groups never merge names, entities or unidentified invoices and never offset credits',()=>{
 const rows=[row,{...row,id:'b',balance:-100},{...row,id:'c',balance:null},{...row,id:'d',issuerId:'two'},{...row,id:'e',customerId:'other'},{...row,id:'f',customerId:null},{...row,id:'g',customerId:null}];
 const g=lib.receivableGroups(rows,'2026-10-29');assert.equal(g.length,5);const first=g.find(x=>x.key==='one:customer');assert.equal(first.outstanding,12100);assert.equal(first.credits,100);assert.equal(first.unknown,1);
});
test('reminder text uses issuer identity and remaining balance without invented fees or attachment claims',()=>{const m=lib.reminderText({...row,balance_cents:2501,due_on:'2026-10-01'});assert.match(m.text,/EUR 25.01/);assert.match(m.text,/Private issuer/);assert.doesNotMatch(m.text,/MZS|attached|fee/i);});
test('follow-up writes and reminder claims enforce active-admin, optimistic revision, idempotency and stale balances in Postgres',()=>{const r=spawnSync(process.execPath,['tests/db/receivables.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
function action({denied=false,context=null}={}){const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/accountancy/sales/receivables/actions.ts'),{exports,require(n){if(n.includes('/admin/i18n'))return adminI18nFixture();if(n==='node:crypto')return require(n);if(n==='next/cache')return {revalidatePath:()=>{}};if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');if(denied)throw Error('denied');return {db:{rpc:async name=>{calls.push(name);return {data:context,error:null}}}}}};if(n.includes('reminder-delivery'))return {prepareReminderDelivery:()=>{calls.push('prepare');return async()=>{calls.push('send');return 'captured'}}};throw Error(n)}});return {exports,calls};}
test('server actions authenticate first and never send without confirmation or a matching current preview',async()=>{
 const f=new FormData();const d=action({denied:true});await assert.rejects(d.exports.sendReminder({},f),/denied/);assert.deepEqual(d.calls,['auth']);
 for(const [k,v] of Object.entries({source:'service',invoice_id:'00000000-0000-4000-8000-000000000001',request_id:'00000000-0000-4000-8000-000000000002'}))f.set(k,v);
 const a=action();assert.equal((await a.exports.sendReminder({},f)).status,'error');assert.deepEqual(a.calls,['auth']);f.set('confirmed','yes');const b=action({context:{balance_cents:10}});assert.equal((await b.exports.sendReminder({},f)).status,'error');assert.ok(!b.calls.includes('prepare'));assert.ok(!b.calls.includes('send'));
});
test('staging reminder uses a captured message, issuer sender name and a trusted result write',async()=>{
 const exports={},calls=[],messages=[];const transport=require('nodemailer').createTransport({streamTransport:true,buffer:true});
 vm.runInNewContext(compile('lib/finance/reminder-delivery.ts'),{exports,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'synthetic-key',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid'}},require(n){if(n.includes('/admin/i18n'))return adminI18nFixture();
  if(n==='nodemailer')return {default:{createTransport:config=>{assert.equal(config.streamTransport,true);return {sendMail:async message=>{messages.push(message);return transport.sendMail(message)},close:()=>transport.close()}}}};
  if(n==='@supabase/supabase-js')return {createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null}}})};
  if(n.includes('invoice-delivery'))return {invoiceMailMode:()=> 'capture'};
  if(n.includes('rental-notifications'))return {classifyRentalMailFailure:()=> 'uncertain'};
  if(n==='./receivables')return lib;throw Error(n);
 }});
 const status=await exports.prepareReminderDelivery()('synthetic-id',{...row,email:'test@example.invalid',balance_cents:2501,due_on:'2026-10-01'});
 assert.equal(status,'captured');assert.equal(messages[0].from.name,'Private issuer');assert.equal(messages[0].from.address,'staging@example.invalid');assert.equal(messages[0].to,'test@example.invalid');assert.equal(messages[0].attachments,undefined);assert.equal(calls[0].args.p_status,'captured');assert.equal(calls[0].name,'mzs_finish_invoice_reminder');
});
test('overview authenticates before reads and renders separate known, unknown and follow-up details',async()=>{
 const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/accountancy/sales/receivables/page.tsx'),{exports,Date,Intl,URLSearchParams,require(n){if(n.includes('/admin/i18n'))return adminI18nFixture();
  if(n==='react/jsx-runtime')return require(n);if(n==='next/link')return {default:'a'};if(n==='next/navigation')return {redirect:()=>{throw Error('redirect')}};if(n.endsWith('.css'))return {default:{}};
  if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');return {db:{}}}};
  if(n.includes('action-queues'))return {operationsDay:()=> '2026-10-29'};
  if(n.includes('invoice-register'))return {invoiceFilters:()=>({year:2026,entity:'all',q:'',page:1}),loadInvoiceRegister:async()=>{calls.push('read');return [row,{...row,id:'b',balance:null}]},selectInvoices:rows=>({rows})};
  if(n.includes('receivables'))return {...lib,withCustomerLinks:async(_,rows)=>rows,loadFollowUps:async()=>({latest:new Map(),rows:[]})};throw Error(n);
 }});
 const tree=await exports.default({searchParams:Promise.resolve({})}),html=require('react-dom/server').renderToStaticMarkup(tree);assert.deepEqual(calls,['auth','read']);assert.match(html,/Receivables &amp; follow-up/);assert.match(html,/€121.00/);assert.match(html,/Balance unknown/);assert.match(html,/No follow-up date/);assert.match(html,/receivables\/service\/a/);
});
