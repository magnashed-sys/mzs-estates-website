import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(file,overrides={}){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(n=>{if(n in overrides)return overrides[n];throw Error(n);},m,m.exports);return m.exports;}
const model=load('lib/estates/booking-accounting.ts');
test('arrival-year allocation is a calendar date and does not invent payment dates',()=>{
 assert.deepEqual(model.bookingAllocation('2025-12-31'),{allocationDate:'2025-12-31',allocationYear:2025});
 assert.throws(()=>model.bookingAllocation('2025-02-29'));assert.throws(()=>model.bookingAllocation('invalid'));
});
test('accountant CSV escapes formula injection, quotes and line breaks',()=>{
 const csv=model.accountingCsv([[' =HYPERLINK("x")','line\nbreak','a;b',null]]);
 assert.ok(csv.includes('"\' =HYPERLINK(""x"")"'));assert.ok(csv.includes('"line\nbreak"'));assert.ok(csv.includes('"a;b";""'));
});
function fixture(fail=false){
 const row={id:'booking',category:'Guest booking',status:'confirmed',property:'Villa',guestName:'Guest',invoiceRecipient:'Company',sourceRef:'123',checkIn:'2025-12-31',checkOut:'2026-01-03',amount:1200};
 const db={rpc:async()=>({data:{total:1,items:[row]}}),from(table){const value=table==='rental_bookings'?{is_test:false,check_in:row.checkIn,check_out:row.checkOut,status:'confirmed',quoted_total_eur:1200}:table==='mzs_booking_receipts'?[{id:'r',amount:1200,received_on:null,receipt_type:'historical_settlement'}]:table==='mzs_booking_invoices'?{number:'ME-2026-0001',issued_on:'2026-10-27'}:null;
 const result={data:value,error:fail&&table==='mzs_booking_receipts'?{message:'offline'}:null};const q={select(){return q},eq(){return q},is(){return q},order(){return q},range:async()=>result,single:async()=>result,maybeSingle:async()=>result};return q;}};
 return load('app/admin/bookings/accountant-export/route.ts',{'../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>({db})},'../../../../lib/estates/booking-accounting':model});
}
test('export keeps historical date unknown and actual issue year distinct from arrival year',async()=>{
 const r=await fixture().GET(new Request('https://example.com/?year=2025'));assert.equal(r.status,200);const csv=await r.text();assert.ok(csv.includes('"2025";"2025-12-31"'));assert.ok(csv.includes('"Paid";"";"1200.00"'));assert.ok(csv.includes('"ME-2026-0001";"2026-10-27"'));assert.ok(r.headers.get('cache-control').includes('no-store'));
});
test('export fails closed for missing receipts and rejects invalid year',async()=>{
 assert.equal((await fixture(true).GET(new Request('https://example.com/?year=2025'))).status,503);
 assert.equal((await fixture().GET(new Request('https://example.com/?year=oops'))).status,400);
});
