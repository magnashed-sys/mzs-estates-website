import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const reconciliation={};vm.runInNewContext(compile('lib/property-operations/sales-reconciliation.ts'),{exports:reconciliation});
const ledger={};vm.runInNewContext(compile('lib/finance/external-receipts.ts'),{exports:ledger,require:()=>reconciliation});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const row=()=>({id:id(1),invoice_id:id(2),amount_cents:25000,received_on:'2026-10-28',reference:'BANK-REF',recorded_by:id(3),created_at:'2026-10-28T12:00:00Z',reversed_at:null,reversed_by:null,reversal_reason:null});
test('standalone balances transition unknown, partial, paid, reversed with source history preserved',()=>{
 assert.equal(ledger.externalPaymentTotals([],id(2),78650).balance,null);const a=row();assert.equal(ledger.externalPaymentTotals([a],id(2),78650).balance,53650);const b={...row(),id:id(4),amount_cents:53650};assert.equal(ledger.externalPaymentTotals([a,b],id(2),78650).balance,0);
 const reversed={...a,reversed_at:'2026-10-28T13:00:00Z',reversed_by:id(3),reversal_reason:'Incorrect registration'};assert.equal(ledger.externalPaymentTotals([reversed],id(2),78650).balance,null);assert.equal(reversed.amount_cents,25000);
 for(const rows of [[a,a],[{...a,amount_cents:80000}],[{...a,reversed_at:'invalid'}],[{...reversed,reversed_by:null}]])assert.throws(()=>ledger.externalPaymentTotals(rows,id(2),78650));
});
test('receipt snapshots fail closed on missing, duplicate, partial or cross-invoice rows',async()=>{
 const source={invoice_ids:[id(2)],count:1,rows:[row()]};
 for(const mutate of [s=>s.count++,s=>s.rows.push(s.rows[0]),s=>s.invoice_ids=[id(99)],s=>s.rows[0].invoice_id=id(99)]){const s=structuredClone(source);mutate(s);await assert.rejects(ledger.loadExternalReceipts({rpc:async()=>({data:s,error:null})},[id(2)]));}
 assert.equal((await ledger.loadExternalReceipts({rpc:async()=>({data:source,error:null})},[id(2)])).length,1);
 await assert.rejects(ledger.loadExternalReceipts({rpc:async()=>({data:null,error:{}})},[id(2)]));
});
function actions(denied=false){const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/accountancy/sales/standalone/actions.ts'),{exports,require(n){if(n.includes('/admin/i18n'))return adminI18nFixture();if(n==='next/cache')return {revalidatePath:p=>calls.push(['refresh',p])};if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');if(denied)throw Error('denied');return {db:{rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_id,error:null}}}}}};if(n.includes('sales-reconciliation'))return reconciliation;if(n.includes('action-queues'))return {operationsDay:()=> '2026-10-28'};throw Error(n)}});return {exports,calls};}
const form=extra=>{const f=new FormData();for(const [k,v] of Object.entries({request_id:id(1),invoice_id:id(2),amount:'250,01',received_on:'2026-10-28',reference:'BANK-REF',confirmed:'yes',...extra}))f.set(k,v);return f;};
test('server actions authenticate before validation, preserve retry IDs and reject future dates, missing confirmation and malformed amounts',async()=>{
 const x=actions();assert.equal((await x.exports.recordExternalReceipt({},form())).status,'success');assert.equal(x.calls[0],'auth');assert.equal(x.calls.find(v=>v.name).args.p_amount_cents,25001);assert.equal(x.calls.find(v=>v.name).args.p_id,id(1));assert.ok(x.calls.some(v=>v[0]==='refresh'&&v[1].includes('standalone')));
 for(const extra of [{amount:'1.001'},{amount:'-1'},{amount:'1e3'},{confirmed:'no'},{received_on:'2026-10-29'},{received_on:'2026-02-30'},{request_id:'bad'},{reference:'\n'}]){const x=actions();assert.equal((await x.exports.recordExternalReceipt({},form(extra))).status,'error');assert.ok(!x.calls.some(v=>v.name));}
 const denied=actions(true);await assert.rejects(denied.exports.recordExternalReceipt({},form()),/denied/);assert.deepEqual(denied.calls,['auth']);
 const rev=actions();assert.equal((await rev.exports.reverseExternalReceipt({},form({receipt_id:id(4),reason:'Wrong transaction entered'}))).status,'success');assert.equal(rev.calls.find(v=>v.name).args.p_invoice,id(2));
});
test('external receipts retain actual receipt and reversal event dates in accountant exports',()=>{
 const result=reconciliation.receiptEvents({source:'external_receipt',id:id(1),amount:'250.01',received_on:'2026-10-28',reversed_at:'2026-10-29T10:00:00Z',reference:'BANK'},id(2),2026);assert.equal(result.events.length,2);assert.equal(result.events[0].amount_eur,'250.01');assert.equal(result.events[1].amount_eur,'-250.01');assert.equal(result.events[1].event_date,'2026-10-29');
});
test('real PostgreSQL receipt constraints, access and immutable audit tests pass',()=>{const r=spawnSync(process.execPath,['tests/db/external-invoice-receipts.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
test('standalone dossier authenticates first and shows recorded balances without exposing mutable invoice fields',async()=>{
 const calls=[],exports={};const invoice={id:id(2),batch_id:id(5),issuer_id:id(6),customer_id:id(7),number:'SYNTHETIC-001',issued_on:'2026-10-28',due_on:'2026-11-11',customer_reference:'Synthetic service',net_cents:65000,vat_cents:13650,gross_cents:78650,currency:'EUR',status:'externally_issued'};
 const db={from(table){calls.push(table);const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:invoice,error:null}),single:async()=>({data:table==='mzs_ops_historical_batches'?{reporting_year:2026}:{name:'Synthetic party'},error:null})};return q;}};
 vm.runInNewContext(compile('app/admin/workspaces/accountancy/sales/standalone/[id]/page.tsx'),{exports,Intl,require(n){if(n.includes('/admin/i18n'))return adminI18nFixture();if(n==='react/jsx-runtime')return require(n);if(n==='next/link')return {default:'a'};if(n==='next/navigation')return {notFound:()=>{throw Error('not-found')}};if(n==='node:crypto')return {randomUUID:()=>id(99)};if(n.endsWith('.css'))return {default:{}};if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');return {db}}};if(n.includes('action-queues'))return {operationsDay:()=> '2026-10-28'};if(n.includes('external-receipts'))return {...ledger,loadExternalReceipts:async()=>[row()]};if(n.includes('PaymentForms'))return {PaymentForm:()=>null,ReversalForm:()=>null};throw Error(n)}});
 const tree=await exports.default({params:Promise.resolve({id:id(2)})}),html=require('react-dom/server').renderToStaticMarkup(tree);assert.equal(calls[0],'auth');assert.match(html,/Partly paid/);assert.match(html,/€536.50/);assert.match(html,/BANK-REF/);assert.match(html,/Payment history/);assert.doesNotMatch(html,/name="gross_cents"/);
 calls.length=0;await assert.rejects(exports.default({params:Promise.resolve({id:'invalid'})}),/not-found/);assert.deepEqual(calls,['auth']);
});
