import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(p,'utf8');
const compile=p=>ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const timeline={};vm.runInNewContext(compile('lib/estates/booking-timeline.ts'),{exports:timeline,Intl,Date});
test('booking date uses Madrid midnight in winter and summer',()=>{
 for(const [utc,day] of [['2026-01-01T22:59:59Z','2026-01-01'],['2026-01-01T23:00:00Z','2026-01-02'],['2026-07-01T21:59:59Z','2026-07-01'],['2026-07-01T22:00:00Z','2026-07-02'],['2026-03-29T01:00:00Z','2026-03-29'],['2026-10-25T01:00:00Z','2026-10-25']])assert.equal(timeline.bookingToday(new Date(utc)),day);
});
async function bookings(dates,language='en'){
 const exports={},calls=[];const rows=dates.map((date,i)=>({id:String(i),category:'Guest booking',property:'Synthetic property',checkIn:date,checkOut:'2026-11-02',status:'confirmed',amount:100,paid:0,guestName:'Synthetic guest '+i,invoiceRecipient:'Synthetic customer',sourceRef:'SOURCE-'+i}));
 vm.runInNewContext(compile('app/admin/bookings/page.tsx'),{exports,Intl,Date,URLSearchParams,require(n){if(n.includes('/admin/i18n'))return adminI18nFixture(language);
  if(n==='react'||n==='react/jsx-runtime')return require(n);
  if(n==='next/link')return {default:'a'};
  if(n==='next/navigation')return {redirect:url=>{throw Error(url)}};
  if(n.includes('booking-timeline'))return {...timeline,bookingToday:()=> '2026-10-28'};
  if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');return {db:{rpc:async(name,args)=>{calls.push({name,args});return {error:null,data:{items:rows,total:rows.length,years:[2026],properties:[],summary:{agreed:0,paid:0,outstanding:0,credit:0,guest:rows.length,owner:0,blocked:0,requested:0}}}}}}}};
  throw Error(n);
 }});
 const tree=await exports.default({searchParams:Promise.resolve({q:'Synthetic',period:'all'})});
 return {html:require('react-dom/server').renderToStaticMarkup(tree),calls};
}
test('rendered booking table places one 12-column divider between future and today, preserves search and hides source column',async()=>{
 const {html,calls}=await bookings(['2026-11-01','2026-10-28','2026-10-20']);
 assert.equal(calls[0],'auth');assert.equal(calls[1].args.p_query,'Synthetic');
 assert.equal((html.match(/data-today-boundary=/g)||[]).length,1);
 assert.ok(html.indexOf('Synthetic guest 0')<html.indexOf('data-today-boundary='));
 assert.ok(html.indexOf('data-today-boundary=')<html.indexOf('Synthetic guest 1'));
 assert.match(html,/colSpan="12"/i);assert.match(html,/Current stay/);
 assert.doesNotMatch(html,/<th[^>]*>Original reference|SOURCE-|id="accountant-export"/);
});
test('today marker remains accurate for filtered pages wholly before or after today and empty results',async()=>{
 for(const [dates,index] of [[['2026-11-02','2026-11-01'],2],[['2026-10-28','2026-10-01'],0],[[],0]]){
 const rows=dates.map(checkIn=>({checkIn}));assert.equal(timeline.bookingTodayBoundary(rows,'2026-10-28'),index);assert.deepEqual(rows.map(r=>r.checkIn),dates);
 const {html}=await bookings(dates);assert.equal((html.match(/data-today-boundary=/g)||[]).length,dates.length?1:0);
 if(dates.length)assert.ok(index===0?html.indexOf('data-today-boundary=')<html.indexOf('Synthetic guest 0'):html.indexOf('data-today-boundary=')>html.indexOf('Synthetic guest 1'));
 }
});
test('Accountancy authenticates before loading global years and keeps the existing booking export route',async()=>{
 const exports={},calls=[];
 vm.runInNewContext(compile('app/admin/workspaces/accountancy/page.tsx'),{exports,require(n){if(n.includes('/admin/i18n'))return adminI18nFixture();
 if(n==='react/jsx-runtime')return require(n);if(n==='next/link')return {default:'a'};if(n.endsWith('.css'))return {default:{}};
 if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');return {db:{rpc:async(name,args)=>{calls.push({name,args});return {data:{years:[2025,2026]},error:null}}}}}};throw Error(n);
 }});
 const html=require('react-dom/server').renderToStaticMarkup(await exports.default());
 assert.equal(calls[0],'auth');assert.equal(calls[1].name,'mzs_admin_bookings_search_v2');assert.equal(calls[1].args.p_limit,1);
 assert.match(html,/id="accountant-export"/);assert.match(html,/action="\/admin\/bookings\/accountant-export"/);assert.match(html,/value="2025"/);assert.match(html,/value="2026"/);
});

test('Spanish bookings translate the register while preserving guest names, query values and timeline boundaries',async()=>{
 const {html,calls}=await bookings(['2026-11-01','2026-10-28'],'es');
 assert.match(html,/Reservas/);assert.match(html,/Synthetic guest 0/);assert.match(html,/Synthetic customer/);assert.equal(calls[1].args.p_query,'Synthetic');assert.equal((html.match(/data-today-boundary=/g)||[]).length,1);assert.doesNotMatch(html,/>Guest booking</);
});
