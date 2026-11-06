import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(path,deps={},globals={}){const exports={};vm.runInNewContext(compile(path),{exports,require:n=>n in deps?deps[n]:require(n),Date,Intl,URLSearchParams,console,...globals});return exports;}
const presentation=load('lib/partner/presentation.ts'),finance=load('lib/partner/finance.ts');
const empty=()=>Object.fromEntries(['leases','bookings','external','services','credit_notes','rent_receipts','guest_receipts','external_receipts','imported_receipts','service_receipts','property_receipts','supplier_payments','costs','imported','loans','loan_instalments','loan_payments','property_bookings','documents'].map(k=>[k,[]]));
test('month filter preserves excluded imports and duplicate checks while separating each dated source',()=>{
 const s=empty();s.leases=[{number:'ONE',issued_on:'2026-01-01',total:100},{number:'TWO',issued_on:'2026-02-01',total:200}];s.guest_receipts=[{received_on:'2026-02-02',amount:20},{received_on:null,amount:999,receipt_type:'historical_settlement'}];s.imported=[{id:'excluded',excluded:true}];s.imported_receipts=[{invoice_id:'excluded',received_on:'2026-02-02',amount:888}];s.supplier_payments=[{paid_on:'2026-02-02',amount_cents:900}];
 const totals=finance.partnerSummary(presentation.periodSource(s,2026,2),2026);assert.equal(totals.invoiced,20000);assert.equal(totals.received,2000);assert.equal(totals.paid,900);assert.equal(s.leases[0].issued_on,'2026-01-01');
 s.services=[{number:'ONE',issued_on:'2026-02-01',total:100}];assert.throws(()=>finance.partnerSummary(presentation.periodSource(s,2026,2),2026),/Ambiguous/);
});
test('calendar validates actual dates, nights and checkout boundaries',()=>{
 assert.equal(presentation.validDay('2026-02-30'),false);assert.equal(presentation.validDay('2028-02-29'),true);
 assert.equal(presentation.nightsBetween('2027-03-27','2027-03-29'),2);
 const blocked=[{check_in:'2027-04-10',check_out:'2027-04-15'}];assert.equal(presentation.overlaps('2027-04-08','2027-04-10',blocked),false);assert.equal(presentation.overlaps('2027-04-15','2027-04-17',blocked),false);assert.equal(presentation.overlaps('2027-04-09','2027-04-11',blocked),true);
});
test('upcoming stays exclude cancelled, pending and past records and sort by arrival',()=>{
 const records=[{id:1,status:'confirmed',check_in:'2027-02-01',check_out:'2027-02-03'},{id:2,status:'cancelled',check_in:'2027-01-01',check_out:'2027-01-03'},{id:3,status:'confirmed',check_in:'2026-11-02',check_out:'2026-11-05'},{id:4,status:'requested',check_in:'2027-01-01',check_out:'2027-01-03'},{id:5,status:'confirmed',check_out:'2026-10-01'}];assert.equal(presentation.upcomingBookings(records,'2026-11-01').map(x=>x.id).join(','),'3,1');
 for(const locale of ['nl','en','es'])for(const status of ['confirmed','pending_review','needs_attention','supplier_invoice'])assert.notEqual(presentation.partnerLabel(status,locale),status);
});
const grant='11111111-1111-4111-8111-111111111111';
function actionFixture({user=true,active=true,allowed=true,duplicate=false,overlap=false,calendarError=false,insertError=false,mailError=false,locale='nl'}={}){
 const inserted=[],invalidated=[],mail=[];
 const db={auth:{getUser:async()=>({data:{user:user?{id:'user'}:null}})},rpc:async()=>({data:calendarError?null:{settings:{maximum_guests:6},unavailable:overlap?[{check_in:'2030-06-11',check_out:'2030-06-13'}]:[]},error:calendarError?{}:null}),from(table){const q={select(){return q},eq(){return q},in(){return q},limit:async()=>({data:duplicate?[{id:'old'}]:[],error:null}),insert(row){inserted.push(row);return q},single:async()=>({data:table==='profiles'?{is_active:active}:table==='mzs_property_partners'?(allowed?{id:grant,project_id:'property'}:null):insertError?null:{id:'new-request'},error:insertError&&table==='mzs_owner_stay_requests'?{}:null})};return q}};
 const action=load('app/private/owner-stays/actions.ts',{'next/cache':{revalidatePath:p=>invalidated.push(p)},'next-intl/server':{getLocale:async()=>locale},'../../../lib/supabase/server':{createClient:async()=>db},'../../../lib/security/phase3a-preview-isolation':{isPhase3aPreviewIsolated:()=>true},'../../../lib/partner/presentation':presentation,'../../../lib/mzs/notifications':{deliverOwnerStayAdminNotifications:async id=>{mail.push(id);if(mailError)throw Error('offline');}}}).requestOwnerStay;
 const form=new FormData();for(const [k,v] of Object.entries({partner_id:grant,check_in:'2030-06-10',check_out:'2030-06-12',guest_count:'2',notes:'Synthetic test'}))form.set(k,v);
 return {form,inserted,invalidated,mail,run:()=>action({status:'idle',message:''},form)};
}
test('owner request rejects absent/inactive/foreign access without a write',async()=>{for(const options of [{user:false},{active:false},{allowed:false}]){const f=actionFixture(options);assert.equal((await f.run()).status,'error');assert.equal(f.inserted.length,0);}});
test('owner request rejects past, impossible, inverted dates and invalid capacity',async()=>{for(const patch of [{check_in:'2020-01-01'},{check_in:'2030-02-30'},{check_out:'2030-06-09'},{guest_count:'7'},{guest_count:'1.5'},{notes:'x'.repeat(1501)}]){const f=actionFixture();for(const [k,v] of Object.entries(patch))f.form.set(k,v);assert.equal((await f.run()).status,'error');assert.equal(f.inserted.length,0);}});
test('occupied dates and duplicate requests produce actionable feedback without inserting',async()=>{for(const options of [{duplicate:true},{overlap:true}]){const f=actionFixture(options);assert.equal((await f.run()).status,'error');assert.equal(f.inserted.length,0);}});
test('owner success is a request only and mail failure cannot turn a saved request into a retry',async()=>{for(const options of [{},{mailError:true},{calendarError:true}]){const f=actionFixture(options),r=await f.run();assert.equal(r.status,'success');assert.equal(f.inserted.length,1);assert.equal(f.inserted[0].status,undefined);assert.equal(f.inserted[0].booking_id,undefined);assert.equal(f.mail.length,1);assert.deepEqual(f.invalidated,['/private/owner-stays','/private/partner']);assert.match(r.message,/nog niet gereserveerd/);}});
test('failed owner inserts do not send mail or invalidate views',async()=>{const f=actionFixture({insertError:true});assert.equal((await f.run()).status,'error');assert.equal(f.mail.length,0);assert.equal(f.invalidated.length,0);});
test('partner access endpoint denies anonymous, failed and empty scopes with private caching',async()=>{
 for(const [user,data,error,expected] of [[null,[{}],null,false],[{},[],null,false],[{},[{}],{},false],[{},[{}],null,true]]){
 const api=load('app/api/private/partner-access/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,options})}},'../../../../lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},rpc:async()=>({data,error})})},'../../../../lib/security/phase3a-preview-isolation':{isPhase3aPreviewIsolated:()=>true}});
 const r=await api.GET();assert.equal(r.body.available,expected);assert.match(r.options.headers['Cache-Control'],/private, no-store/);
 }
});
test('all dashboard views render NL/EN/ES, searchable documents and separate cancelled history',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const source={...empty(),issuer:{id:'entity-a',name:'Synthetic company'},snapshot_at:'2026-11-01T12:00:00Z'};
 source.property_bookings=[{id:'stay',property_name:'TEST property',status:'confirmed',check_in:'2030-01-01',check_out:'2030-01-03',quoted_total_eur:0},{id:'cancel',property_name:'CANCELLED RECORD',status:'cancelled',check_in:'2030-01-01',check_out:'2030-01-03',quoted_total_eur:0}];
 source.documents=[{id:'document',title:'Findable invoice',category:'supplier_invoice',fiscal_year:2030,document_date:'2030-02-01',review_status:'pending_review'},{id:'excluded',title:'Other document',fiscal_year:2030,document_date:'2030-03-01'}];
 for(const locale of ['nl','en','es']){
 const db={auth:{getUser:async()=>({data:{user:{id:'partner'}}})},rpc:async n=>({data:n==='mzs_partner_entities'?[source.issuer]:source}),from:()=>({select(){return this},eq(){return this},single:async()=>({data:{full_name:'Synthetic Partner'}})})};
 const page=load('app/private/partner/page.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{notFound:()=>{throw Error('not found')},redirect:()=>{throw Error('redirect')}},'next-intl/server':{getLocale:async()=>locale},'../../../lib/supabase/server':{createClient:async()=>db},'../../../lib/security/phase3a-preview-isolation':{isPhase3aPreviewIsolated:()=>true},'../../../lib/partner/finance':finance,'../../../lib/partner/presentation':presentation,'../../../lib/partner/spanish':load('lib/partner/spanish.ts'),'./PartnerHeader':{default:()=>null},'./partner.module.css':{default:new Proxy({},{get:(_,key)=>key})}}).default;
 for(const view of ['overview','finance','stays','documents']){
 const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({view,year:'2030'})}));assert.match(html,/Synthetic/);assert.doesNotMatch(html.replace(/<[^>]*>/g,''),/pending_review|supplier_invoice/);if(view==='stays')assert.doesNotMatch(html,/CANCELLED RECORD/);
 }
 const result=renderToStaticMarkup(await page({searchParams:Promise.resolve({view:'documents',year:'2030',month:'2',q:'findable',category:'supplier_invoice'})}));assert.match(result,/Findable invoice/);assert.doesNotMatch(result,/Other document/);
 const history=renderToStaticMarkup(await page({searchParams:Promise.resolve({view:'stays',year:'2030',status:'history'})}));assert.match(history,/CANCELLED RECORD/);
 }
});

test('record pages bound oversized or invalid page requests without changing source rows',()=>{
 const records=Array.from({length:51},(_,id)=>({id}));
 for(const value of [undefined,'0','-2','1.5','1e2',['2']])assert.equal(presentation.recordPage(records,value).page,1);
 const page=presentation.recordPage(records,'2');assert.equal(page.records.length,25);assert.equal(page.records[0].id,25);assert.equal(page.start,26);assert.equal(page.end,50);
 const last=presentation.recordPage(records,'999');assert.equal(last.page,3);assert.equal(last.records[0].id,50);assert.equal(records.length,51);
 const emptyPage=presentation.recordPage([],'2');assert.equal(emptyPage.start,0);assert.equal(emptyPage.pages,1);
});

test('partner pagination retains filters, complete financial totals and labelled mobile amounts',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const source={...empty(),issuer:{id:'entity-a',name:'Synthetic company'},snapshot_at:'2026-11-06T12:00:00Z'};
 source.leases=Array.from({length:30},(_,i)=>({id:'invoice-'+i,number:'SYNTH-'+String(i).padStart(2,'0'),issued_on:'2030-02-01',total:100,status:'issued'}));
 source.documents=Array.from({length:30},(_,i)=>({id:'doc-'+i,title:'Findable document '+String(i).padStart(2,'0'),category:'supplier_invoice',fiscal_year:2030,document_date:'2030-02-01',review_status:'pending_review'}));
 const db={auth:{getUser:async()=>({data:{user:{id:'partner'}}})},rpc:async n=>({data:n==='mzs_partner_entities'?[source.issuer]:source}),from:()=>({select(){return this},eq(){return this},single:async()=>({data:{full_name:'Synthetic Partner'}})})};
 const page=load('app/private/partner/page.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':{notFound:()=>{throw Error('not found')},redirect:()=>{throw Error('redirect')}},'next-intl/server':{getLocale:async()=>'en'},'../../../lib/supabase/server':{createClient:async()=>db},'../../../lib/security/phase3a-preview-isolation':{isPhase3aPreviewIsolated:()=>true},'../../../lib/partner/finance':finance,'../../../lib/partner/presentation':presentation,'../../../lib/partner/spanish':load('lib/partner/spanish.ts'),'./PartnerHeader':{default:()=>null},'./partner.module.css':{default:new Proxy({},{get:(_,key)=>key})}}).default;
 const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({view:'finance',entity:'entity-a',year:'2030',month:'2',page_invoices:'2'})}));
 assert.match(html,/€3,000\.00/);assert.match(html,/SYNTH-25/);assert.doesNotMatch(html,/SYNTH-00/);assert.match(html,/26–30 of 30/);assert.match(html,/page_invoices=1#invoices/);
 const summary=html.match(/<summary><span class="recordLead">[\s\S]*?<\/summary>/)?.[0];assert.match(summary,/1 Feb 2030/);assert.match(summary,/<small>Total<\/small><strong>€100\.00<\/strong>/);
 const docs=renderToStaticMarkup(await page({searchParams:Promise.resolve({view:'documents',entity:'entity-a',year:'2030',month:'2',q:'Findable',category:'supplier_invoice',page_documents:'2'})}));
 assert.doesNotMatch(docs,/Findable document 00/);assert.match(docs,/Findable document 25/);
 assert.match(docs,/entity=entity-a&amp;year=2030&amp;month=2&amp;view=documents&amp;q=Findable&amp;category=supplier_invoice&amp;page_documents=1#documents/);
 assert.equal(source.leases.length,30);
});
