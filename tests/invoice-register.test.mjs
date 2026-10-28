import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(p){p=path.resolve(p);if(cache.has(p))return cache.get(p);const exports={};cache.set(p,exports);vm.runInNewContext(compile(p),{exports,Date,Intl,URLSearchParams,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(p),n)+'.ts'):require(n)});return exports;}
const lib=load('lib/finance/invoice-register.ts'),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),today='2026-10-28';
function fixture(){const common={issuer_id:id(1),issued_on:'2026-10-01'};return {externalReceipts:[],issuers:[{id:id(1),name:'Synthetic issuer'}],customers:[{id:id(2),name:'Synthetic standalone customer'}],rentals:[{...common,id:id(3),number:'R-1',due_date:'2026-10-15',total:'100.01',customer:'Synthetic tenant',subject:'October rent'}],bookings:[{...common,id:id(4),number:'B-1',booking_id:id(7),total:'50.00',customer:'Synthetic guest'}],external:[{...common,id:id(5),number:'7113',issued_on:today,due_on:'2026-11-11',customer_id:id(2),customer_reference:'External services',net_cents:65000,vat_cents:13650,gross_cents:78650,currency:'EUR',status:'externally_issued',payment_status:'not_recorded'}],archive:[{...common,id:id(6),number:'A-1',customer_name:'Synthetic archive customer',subject:'Original source',due_on:'2026-10-15',gross_cents:2000,source_paid_cents:1000,source_open_cents:1000}],rentReceipts:[{id:id(8),invoice_id:id(3),amount:'25.01',reversed_at:null},{id:id(9),invoice_id:id(3),amount:'75.00',reversed_at:'2026-10-20T12:00:00Z'}],bookingReceipts:[{id:id(10),booking_id:id(7),amount:'55.00',reversed_at:null}]};}
const filters=overrides=>({...lib.invoiceFilters({},new Date(today+'T12:00:00Z')),...overrides});
test('unified invoices reconcile cents, preserve unknown standalone payments and ignore reversed receipts',()=>{
 const rows=lib.normalizeInvoiceRegister(fixture()),{totals}=lib.selectInvoices(rows,filters(),today);
 assert.equal(rows.length,4);const external=rows.find(i=>i.source==='external');assert.equal(external.paid,null);assert.equal(external.balance,null);assert.equal(lib.invoiceStatus(external,today),'Payment unknown');
 assert.equal(rows.find(i=>i.source==='rental').balance,7500);assert.equal(lib.invoiceStatus(rows.find(i=>i.source==='rental'),today),'Overdue');assert.equal(lib.invoiceStatus(rows.find(i=>i.source==='booking'),today),'Credit balance');
 assert.equal(totals.gross,95651);assert.equal(totals.outstanding,8500);assert.equal(totals.overdue,8500);assert.equal(totals.unknown,1);assert.equal(totals.unknownGross,78650);assert.equal(totals.credits,500);
 assert.equal(lib.selectInvoices(rows,filters({status:'open'}),today).rows.length,3);
 assert.equal(lib.selectInvoices(rows,filters({q:'EXTERNAL SERVICES'}),today).rows.length,1);
});
test('archive credit notes remain signed and do not reduce another customer outstanding balance',()=>{
 const x=fixture();x.archive.push({...x.archive[0],id:id(11),number:'C-1',gross_cents:-1210,source_paid_cents:-1210,source_open_cents:0});
 const rows=lib.normalizeInvoiceRegister(x),report=lib.selectInvoices(rows,filters(),today);assert.equal(report.totals.outstanding,8500);assert.equal(report.totals.gross,94441);assert.equal(lib.selectInvoices(rows,filters({status:'credit'}),today).rows.length,2);
});
test('matching imported copies count once; conflicting numbers and ambiguous booking allocations fail closed',()=>{
 const x=fixture();x.archive.push({...x.archive[0],id:id(11),number:'R-1',gross_cents:10001,source_paid_cents:10001,source_open_cents:0});const rows=lib.normalizeInvoiceRegister(x);assert.equal(rows.length,4);assert.equal(rows.find(i=>i.source==='rental').paid,2501);assert.equal(rows.find(i=>i.source==='rental').alsoImported,true);
 x.archive.at(-1).gross_cents++;x.archive.at(-1).source_open_cents++;assert.throws(()=>lib.normalizeInvoiceRegister(x));
 const y=fixture();y.bookings.push({...y.bookings[0],id:id(12),number:'B-2'});assert.throws(()=>lib.normalizeInvoiceRegister(y));
});
test('same invoice numbers in different legal entities are not duplicates',()=>{const x=fixture();x.issuers.push({id:id(12),name:'Second issuer'});x.archive.push({...x.archive[0],id:id(11),issuer_id:id(12)});assert.equal(lib.normalizeInvoiceRegister(x).length,5);});
test('invalid amounts, dates, missing names, partial balances and duplicated receipts cannot become totals',()=>{
 for(const change of [x=>x.archive[0].source_paid_cents++,x=>x.external[0].payment_status='paid',x=>x.issuers=[],x=>x.rentals[0].customer=null,x=>x.rentals[0].issued_on='2026-02-30',x=>x.rentReceipts.push(x.rentReceipts[0]),x=>x.bookingReceipts[0].booking_id=id(99),x=>x.archive[0].gross_cents='2000',x=>x.rentReceipts[0].amount='1.001']){const x=fixture();change(x);assert.throws(()=>lib.normalizeInvoiceRegister(x));}
});
test('filters and export preserve selection, dates use Madrid, unknown balances stay blank and cells are escaped',()=>{
 assert.equal(lib.invoiceFilters({},new Date('2026-12-31T23:30:00Z')).year,2027);
 for(const invalid of [{year:['2025','2026']},{source:'__proto__'},{status:'paid_or_unknown'},{page:'0'},{q:'x'.repeat(151)}])assert.throws(()=>lib.invoiceFilters(invalid));
 assert.equal(lib.invoiceHref(filters({q:'A & B',source:'external',status:'unknown'}),3),'/admin/workspaces/accountancy/sales?year=2026&q=A+%26+B&source=external&status=unknown&page=3');
 const x=fixture();x.external[0].customer_reference='=HYPERLINK("bad")';const csv=lib.invoiceRegisterCsv(lib.normalizeInvoiceRegister(x),today);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/"78650","","","Payment unknown"/);assert.match(csv,/imported_snapshot/);
});
function database({count=1201,short=false,broken=false}={}){
 const calls=[];const x=fixture();const source={mzs_lease_issuers:x.issuers,mzs_lease_relationships:x.customers,mzs_lease_invoices:[],mzs_booking_invoices:[],mzs_ops_external_sales_invoices:x.external,mzs_invoice_archive_active:Array.from({length:count},(_,n)=>({...x.archive[0],id:id(n+100),number:'A-'+n}))};
 return {calls,db:{rpc:async(n,args)=>({data:{invoice_ids:args.p_invoice_ids,count:0,rows:[]},error:null}),from(table){calls.push(table);let start=0,end=499;const b={select(columns,opt){assert.equal(opt.count,'exact');return b},gte(){return b},lt(){return b},order(column){assert.equal(column,'id');return b},range(a,z){start=a;end=z;return b},then(resolve){const data=source[table]??[];return Promise.resolve({data:short&&table==='mzs_invoice_archive_active'?data.slice(0,1):data.slice(start,end+1),count:data.length,error:broken&&table==='mzs_ops_external_sales_invoices'?{message:'denied'}:null}).then(resolve)}};return b}}};
}
test('loader reads beyond API limits from the active archive and refuses short or failed source reads',async()=>{
 const x=database();const rows=await lib.loadInvoiceRegister(x.db,2026);assert.equal(rows.length,1202);assert.equal(rows.filter(i=>i.source==='external').length,1);assert.ok(x.calls.includes('mzs_invoice_archive_active'));assert.ok(!x.calls.includes('mzs_invoice_archive'));
 await assert.rejects(lib.loadInvoiceRegister(database({short:true}).db,2026));await assert.rejects(lib.loadInvoiceRegister(database({broken:true}).db,2026));
});
function route({denied=false,broken=false}={}){const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/accountancy/sales/export/route.ts'),{exports,Response,URL,require(n){if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');if(denied)throw Error('denied');return {db:{}}}};if(n.includes('action-queues'))return {operationsDay:()=>today};if(n.includes('invoice-register'))return {...lib,loadInvoiceRegister:async()=>{calls.push('read');if(broken)throw Error('incomplete');return lib.normalizeInvoiceRegister(fixture())}};throw Error(n)}});return {calls,get:q=>exports.GET({url:'https://fixture.invalid/?'+q})};}
test('CSV authenticates first, rejects duplicated filters and fails without a partial export',async()=>{
 const denied=route({denied:true});await assert.rejects(denied.get(''),/denied/);assert.deepEqual(denied.calls,['auth']);const invalid=route();assert.equal((await invalid.get('year=2026&year=2025')).status,400);assert.deepEqual(invalid.calls,['auth']);assert.equal((await route({broken:true}).get('year=2026')).status,503);
 const ok=await route().get('year=2026&source=external');assert.equal(ok.status,200);assert.equal(ok.headers.get('Cache-Control'),'private, no-store');const csv=await ok.text();assert.equal(csv.split('\n').filter(Boolean).length,2);assert.match(csv,/7113/);
});
test('rendered register includes standalone invoice, preserves filters and paginates without partial totals',async()=>{
 const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/accountancy/sales/page.tsx'),{exports,Intl,Date,require(n){if(n==='react/jsx-runtime')return require(n);if(n==='next/link')return {default:'a'};if(n==='next/navigation')return {redirect:u=>{throw Error('redirect:'+u)}};if(n.endsWith('.css'))return {default:{}};if(n.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('auth');return {db:{}}}};if(n.includes('action-queues'))return {operationsDay:()=>today};if(n.includes('invoice-register'))return {...lib,loadInvoiceRegister:async()=>{calls.push('read');return lib.normalizeInvoiceRegister(fixture())}};throw Error(n)}});
 const tree=await exports.default({searchParams:Promise.resolve({year:'2026',source:'external'})}),html=require('react-dom/server').renderToStaticMarkup(tree);assert.deepEqual(calls,['auth','read']);assert.match(html,/7113/);assert.match(html,/Payment unknown/);assert.match(html,/€786.50/);assert.doesNotMatch(html,/Synthetic tenant/);assert.match(html,/name="source"/);assert.match(html,/source=external/);
 await assert.rejects(exports.default({searchParams:Promise.resolve({year:'2026',source:'external',page:'9'})}),/redirect:.*source=external/);
});
test('standalone receipt evidence updates the unified status and CSV without changing the invoice source snapshot',()=>{
 const x=fixture();x.externalReceipts=[{id:id(50),invoice_id:id(5),amount_cents:25000,received_on:today,reference:'BANK-EXT',recorded_by:id(51),created_at:today+'T12:00:00Z',reversed_at:null,reversed_by:null,reversal_reason:null}];
 const invoice=lib.normalizeInvoiceRegister(x).find(i=>i.source==='external');assert.equal(invoice.paid,25000);assert.equal(invoice.balance,53650);assert.equal(invoice.paymentBasis,'receipt_register');assert.equal(lib.invoiceStatus(invoice,today),'Partly paid');assert.match(lib.invoiceRegisterCsv([invoice],today),/"25000","53650"/);assert.equal(x.external[0].payment_status,'not_recorded');
 x.externalReceipts[0].amount_cents=78650;assert.equal(lib.selectInvoices(lib.normalizeInvoiceRegister(x),filters({status:'paid',source:'external'}),today).rows.length,1);
});
