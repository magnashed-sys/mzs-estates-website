import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import fs from 'node:fs';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('lib/partner/finance.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {partnerSummary,availableYears,cents,integerCents}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const empty=()=>Object.fromEntries(['leases','bookings','external','services','credit_notes','rent_receipts','guest_receipts','external_receipts','imported_receipts','service_receipts','supplier_payments','costs','imported','loans'].map(k=>[k,[]]));
test('partner financial cards separate invoices, receipts, reversals and historical sources',()=>{
 const s=empty();s.leases=[{issued_on:'2026-01-01',total:'100.25'},{issued_on:'2025-01-01',total:999}];s.credit_notes=[{issued_on:'2026-01-02',gross_cents:2000}];s.imported=[{issued_on:'2026-01-01',gross_cents:99999,source_paid_cents:99999}];
 s.guest_receipts=[{received_on:'2026-01-01',amount:50,receipt_type:'payment'},{received_on:null,amount:1000,receipt_type:'historical_settlement'},{received_on:'2026-02-01',amount:90,reversed_at:'2026-02-02'}];
 s.supplier_payments=[{paid_on:'2026-01-01',amount_cents:1500},{paid_on:'2026-01-01',amount_cents:500,reversed_at:'2026-02-01'}];
 s.costs=[{invoice_date:'2026-01-01',review_status:'reviewed',status:'draft',currency:'EUR',gross_cents:2500},{invoice_date:'2026-01-01',review_status:'pending',gross_cents:90000}];
 assert.deepEqual(partnerSummary(s,2026),{invoiced:8025,received:5000,paid:1500,reviewedCosts:2500});assert.deepEqual(availableYears(s,2026),[2026,2025]);
});
test('invalid financial source fails instead of showing zero',()=>{assert.throws(()=>partnerSummary({},2026));for(const v of [null,'',NaN,Infinity,true,'1.001'])assert.throws(()=>cents(v));assert.throws(()=>integerCents(1.2));});
test('partner database authorization and read-only boundaries',{timeout:120000},()=>{const out=execFileSync(process.execPath,['tests/db/partner-access.cjs'],{encoding:'utf8',timeout:110000});assert.match(out,/read-only tests passed/);});

test('duplicate invoice or receipt attribution fails closed',()=>{const s=empty();s.leases=[{number:'A',issued_on:'2026-01-01',total:10}];s.services=[{number:' a ',issued_on:'2026-01-01',total:10}];assert.throws(()=>partnerSummary(s,2026),/Ambiguous/);s.services=[];s.rent_receipts=[{id:'same',received_on:'2026-01-01',amount:10},{id:'same',received_on:'2026-01-01',amount:10}];assert.throws(()=>partnerSummary(s,2026),/Duplicate/);});

test('partner page renders scoped read-only data, year controls and owner navigation',async()=>{
 const {createRequire}=await import('node:module'),vm=await import('node:vm'),require=createRequire(import.meta.url);
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');let locale='nl',identity=true,requestedEntity;
 const source={...empty(),issuer:{id:'entity-a',name:'Synthetic Mase'},snapshot_at:'2026-10-30T12:00:00Z',documents:[],loan_instalments:[],loan_payments:[],costs:[]};
 const db={auth:{getUser:async()=>({data:{user:identity?{id:'partner'}:null}})},rpc:async(name,args)=>{requestedEntity=args?.p_entity;return {data:name==='mzs_partner_entities'?[source.issuer]:source,error:null}},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{full_name:'Synthetic partner'}})})})})};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/private/partner/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Intl,Error,require:name=>{
  if(name==='next/link')return {default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='next/navigation')return {redirect:()=>{throw Error('redirect')},notFound:()=>{throw Error('not found')}};
  if(name==='next-intl/server')return {getLocale:async()=>locale};
  if(name.endsWith('/supabase/server'))return {createClient:async()=>db};
  if(name.includes('preview-isolation'))return {isPhase3aPreviewIsolated:()=>true};
  if(name.endsWith('/partner/finance'))return {availableYears,cents,integerCents,inYear:(r,k,y)=>r[k]?.startsWith(String(y)),invoiceKeys:['leases','bookings','external','services'],receiptKeys:['rent_receipts','guest_receipts','external_receipts','imported_receipts','service_receipts'],rows:(s,k)=>s[k],partnerSummary};
  if(name.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>key})};return require(name);
 }});
 const html=renderToStaticMarkup(await exports.default({searchParams:Promise.resolve({})}));assert.equal(requestedEntity,'entity-a');assert.match(html,/Alleen lezen/);assert.match(html,/Synthetic partner/);assert.match(html,/method="get"/);assert.match(html,/href="\/private\/owner-stays"/);assert.doesNotMatch(html,/method="post"|type="file"/);
 await assert.rejects(exports.default({searchParams:Promise.resolve({entity:'other'})}),/not found/);
 locale='en';assert.match(renderToStaticMarkup(await exports.default({searchParams:Promise.resolve({})})),/Read only/);
 identity=false;await assert.rejects(exports.default({searchParams:Promise.resolve({})}),/redirect/);
});
