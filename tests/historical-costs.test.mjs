import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {inflateRawSync} from 'node:zlib';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url),modules={};
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const name of ['staff-work','finance','action-queues','weekly-import','sales-reconciliation','historical-costs','accountant-archive']){const exports={};vm.runInNewContext(compile('lib/property-operations/'+name+'.ts'),{exports,Date,Intl,URLSearchParams,Buffer,Uint8Array,TextEncoder,require:n=>n.startsWith('node:')?require(n):modules[n.replace('./','')]});modules[name]=exports;}
const credit={};vm.runInNewContext(compile('lib/finance/credit-notes.ts'),{exports:credit,require:n=>n.includes('sales-reconciliation')?modules['sales-reconciliation']:{}});
const salesPackage={};vm.runInNewContext(compile('lib/accountancy/sales-package.ts'),{exports:salesPackage,Set,Buffer,Uint8Array,TextEncoder,require:n=>n.includes('credit-notes')?credit:modules[n.split('/').pop()]});
const h=modules['historical-costs'],id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),filters=()=>h.historyFilters({year:'2026'});
function fixture(){return {year:2026,profile:null,snapshot_at:'2026-10-28T20:00:00Z',batches:[{id:id(1),profile_id:id(2),person_name:'Synthetic worker',reporting_year:2026,source_name:'Synthetic CSV',source_file_id:'libfile_synthetic',source_sha256:'a'.repeat(64),hash_basis:'extracted_csv_utf8_lf',expected_rows:3,expected_cost_cents:18750,created_at:'2026-10-28T20:00:00Z'}],invoices:[{id:id(3),batch_id:id(1),issuer_id:id(4),customer_id:id(5),property_id:id(6),issuer_name:'Synthetic entity',customer_name:'Synthetic customer',property_name:'Synthetic building',number:'EXT-TEST-1',issued_on:'2026-10-28',due_on:'2026-11-11',period_from:'2026-02-09',period_until:'2026-02-15',customer_reference:'Synthetic reference',net_cents:7500,vat_cents:1575,gross_cents:9075,vat_basis_points:2100,billed_hours:3,hourly_rate_cents:2500,currency:'EUR',status:'externally_issued',delivery_status:'not_recorded',payment_status:'not_recorded',source_file_id:'libfile_invoice',source_name:'Synthetic invoice.pdf'}],rows:[0,1,2].map((n)=>({id:id(10+n),batch_id:id(1),profile_id:id(2),reporting_year:2026,reference:'ROW-'+n,iso_week:7,period_from:'2026-02-09',period_until:'2026-02-15',original_location:n===2?'Other':'Zorg',category:'Cleaning',description:'Synthetic statement',cost_cents:[5000,1250,12500][n],recharge:n===2?'Te beoordelen':'Ja',source_reference:'#123',source_check:'Source check',source_billing_reference:n===2?'':'Historical invoice reference',invoice_id:n===2?null:id(3),billed_hours:n===2?null:[2,1][n],recharge_cents:n===2?null:[5000,2500][n]}))};}
test('historical costs preserve source costs and billed hours without reconstructing visits, VAT on costs or payments',()=>{
 const r=h.normalizeHistory(fixture(),filters());assert.equal(r.totalCost,18750);assert.equal(r.rechargedCost,6250);assert.equal(r.billedHours,3);assert.equal(r.reviewCount,1);assert.equal(r.groups.find(g=>g.location==='Zorgbalans').invoiced,7500);assert.equal(r.rows[0].original_location,'Zorg');assert.ok(r.rows.every(x=>!Object.hasOwn(x,'actual_minutes')));assert.equal(r.invoices[0].payment_status,'not_recorded');
});
test('history rejects missing/duplicate rows, broken invoice joins and inconsistent tax, hours, cost or source snapshots',()=>{
 const changes=[s=>s.rows.pop(),s=>s.rows[1].id=s.rows[0].id,s=>s.rows[1].reference=s.rows[0].reference,s=>s.rows[0].cost_cents++,s=>s.rows[0].cost_cents=1.5,s=>s.invoices[0].vat_cents++,s=>s.invoices[0].billed_hours++,s=>s.invoices[0].payment_status='paid',s=>s.invoices[0].status='draft',s=>s.invoices=[],s=>s.rows[0].invoice_id=null,s=>s.rows[0].billed_hours=null,s=>s.rows[0].recharge_cents=null,s=>s.rows[0].period_from='2026-02-08',s=>s.rows[0].profile_id=id(99),s=>s.batches[0].source_file_id='javascript:alert(1)',s=>s.batches[0].source_sha256='',s=>s.year=2025,s=>s.rows[0].source_check=null];
 for(const change of changes){const s=fixture();change(s);assert.throws(()=>h.normalizeHistory(s,filters()),/incomplete|inconsistent/);}
});
test('history filters use Madrid reporting year and canonical admin-only URLs and source links',()=>{
 assert.equal(h.historyFilters({},new Date('2026-12-31T23:30:00Z')).year,2027);
 for(const p of [{year:['2026','2025']},{year:'1999'},{profile:'bad'}])assert.throws(()=>h.historyFilters(p));
 assert.equal(h.historyHref({...filters(),profile:id(2)},2),'/admin/workspaces/estates/history?year=2026&profile='+id(2)+'&page=2');assert.ok(!h.historyHref(filters(),3,true).includes('page='));assert.throws(()=>h.librarySourceHref('https://evil.invalid'));
});
test('historical CSV distinguishes billed hours from unknown actual minutes and neutralizes spreadsheet formulas',()=>{
 const s=fixture();s.rows[0].description='=SUM(1,2)';const csv=h.historyCsv(h.normalizeHistory(s,filters()));assert.equal(csv.charCodeAt(0),0xfeff);assert.match(csv,/"actual_minutes","time_note","payment_status"/);assert.match(csv,/'=SUM\(1,2\)/);assert.match(csv,/"5000","","Weekly cost statement; billed hours are not actual worked minutes","not_recorded"/);assert.match(csv,/libfile_synthetic/);assert.ok(!csv.includes('recorded_receipt'));
});
function route(path,{source,denied=false,environment=true,lib=modules['historical-costs']}={}){const exports={},calls=[];vm.runInNewContext(compile(path),{exports,Response,URL,Buffer,Uint8Array,require(name){if(name.includes('/admin/i18n'))return adminI18nFixture();
 if(name.includes('property-staff'))return {staffEnvironmentAvailable:()=>environment};
 if(name.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('admin');if(denied)throw Error('denied');return {db:{rpc:async()=>{calls.push('query');return {data:source,error:null};}}};}};
 if(name.includes('sales-package'))return salesPackage;
 if(name.includes('credit-notes'))return credit;
 if(name.includes('historical-costs'))return lib;
 if(name.includes('sales-reconciliation'))return modules['sales-reconciliation'];if(name.includes('accountant-archive'))return modules['accountant-archive'];if(name.endsWith('/finance'))return modules.finance;
 throw Error('Unexpected module '+name);
 }});return {get:query=>exports.GET({url:'https://fixture.invalid/?'+query}),calls};}
const historyRoute='app/admin/workspaces/estates/history/export/route.ts';
test('history export guards access, duplicate input, incomplete data and limits before exposing a private complete CSV',async()=>{
 const denied=route(historyRoute,{denied:true});await assert.rejects(denied.get('year=2026'),/denied/);assert.deepEqual(denied.calls,['admin']);
 assert.equal((await route(historyRoute,{environment:false}).get('year=2026')).status,404);
 const invalid=route(historyRoute,{source:fixture()});assert.equal((await invalid.get('year=2026&year=2025')).status,400);assert.deepEqual(invalid.calls,['admin']);
 assert.equal((await route(historyRoute,{source:{}}).get('year=2026')).status,503);
 assert.equal((await route(historyRoute,{source:fixture(),lib:{...h,historyCsv:()=> 'x'.repeat(4*1024*1024+1)}}).get('year=2026')).status,413);
 const good=await route(historyRoute,{source:fixture()}).get('year=2026');assert.equal(good.status,200);assert.equal(good.headers.get('Cache-Control'),'private, no-store');assert.equal(good.headers.get('X-Content-Type-Options'),'nosniff');
});
function salesSource(){return {issuer:{id:id(4),name:'Synthetic issuer'},snapshot_at:'2026-10-28',leases:[],bookings:[],rent_receipts:[],guest_receipts:[],credit_notes:[],services:[],service_receipts:[],imported:[],imported_receipts:[],external_receipts:[],external:[{id:id(3),batch_id:id(1),issuer_id:id(4),number:'EXT-TEST-1',issued_on:'2026-10-28',net_total:75,vat_total:15.75,total:90.75,status:'externally_issued'}]};}
function unzip(buffer){const files={};let o=0;while(buffer.readUInt32LE(o)===0x04034b50){const compressed=buffer.readUInt32LE(o+18),nameLen=buffer.readUInt16LE(o+26),extra=buffer.readUInt16LE(o+28),name=buffer.subarray(o+30,o+30+nameLen).toString(),data=o+30+nameLen+extra;files[name]=inflateRawSync(buffer.subarray(data,data+compressed)).toString();o=data+compressed;}return files;}
test('accountant ZIP contains external invoices exactly once with known VAT and no invented receipts',async()=>{
 const r=await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source:salesSource()}).get('entity='+id(4)+'&year=2026');assert.equal(r.status,200);
 const files=unzip(Buffer.from(await r.arrayBuffer()));assert.equal(files['issued-sales-invoices.csv'].split('EXT-TEST-1').length-1,1);assert.match(files['issued-sales-invoices.csv'],/external_cost_invoice/);assert.match(files['issued-sales-invoices.csv'],/"90.75","75.00","15.75"/);const manifest=JSON.parse(files['manifest.json']);assert.equal(manifest.invoice_rows,1);assert.equal(manifest.receipt_events,0);assert.equal(manifest.exceptions,0);
});
test('accountant export fails on duplicate invoice numbers across sources, unknown tax and absent external source',async()=>{
 for(const change of [s=>s.leases.push({...s.external[0],id:id(77),contract_id:id(78)}),s=>delete s.external,s=>s.external[0].status='draft',s=>delete s.external[0].vat_total,s=>s.external[0].total=90.76]){const s=salesSource();change(s);const r=await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source:s}).get('entity='+id(4)+'&year=2026');assert.equal(r.status,503);}
});
test('historical page checks active admin before data and paginates only detail while retaining whole-register totals',async()=>{
 const source=fixture();source.invoices=[];source.rows=Array.from({length:61},(_,n)=>({...source.rows[2],id:id(100+n),reference:'SYN-'+n,cost_cents:100}));source.batches[0].expected_rows=61;source.batches[0].expected_cost_cents=6100;
 for(const denied of [true,false]){const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/estates/history/page.tsx'),{exports,Intl,require(name){if(name.includes('/admin/i18n'))return adminI18nFixture();
 if(name==='react/jsx-runtime')return require(name);if(name==='next/link')return {default:'a'};if(name==='next/navigation')return {redirect:href=>{throw Error('redirect:'+href);}};if(name.endsWith('.css'))return {default:{}};
 if(name.includes('property-staff'))return {requireStaffEnvironment:()=>calls.push('environment')};
 if(name.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('admin');if(denied)throw Error('denied');return {db:{rpc:async()=>{calls.push('query');return {data:source,error:null};}}};}};
 if(name.includes('sales-package'))return salesPackage;
 if(name.includes('credit-notes'))return credit;
 if(name.includes('historical-costs'))return h;throw Error(name);
 }});
 const render=page=>exports.default({searchParams:Promise.resolve({year:'2026',page})});
 if(denied){await assert.rejects(render('1'),/denied/);assert.deepEqual(calls,['environment','admin']);}else{const tree=await render('3'),json=JSON.stringify(tree);assert.equal((json.match(/SYN-/g)??[]).length,11);assert.match(json,/61\.00/);await assert.rejects(render('999'),/redirect:.*page=3/);}}
});
test('historical imports and external invoices enforce real PostgreSQL lifecycle, access and duplicate controls',()=>{const r=spawnSync(process.execPath,['tests/db/historical-costs.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});

test('accountant ZIP includes explicit standalone receipt and reversal events without inventing cash',async()=>{
 const source=salesSource();source.external_receipts=[{id:id(20),invoice_id:id(3),amount:25.01,received_on:'2026-10-28',reference:'BANK-TEST',reversed_at:'2026-10-29T12:00:00Z'}];
 const r=await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year=2026');assert.equal(r.status,200);const files=unzip(Buffer.from(await r.arrayBuffer()));const manifest=JSON.parse(files['manifest.json']);assert.equal(manifest.receipt_events,2);assert.match(files['registered-receipt-events.csv'],/external_receipt/);assert.match(files['registered-receipt-events.csv'],/"25.01"/);assert.match(files['registered-receipt-events.csv'],/"'-25.01"/);
 source.external_receipts[0].invoice_id=id(99);assert.equal((await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year=2026')).status,503);
});
test('accountant exports dated imported receipts across invoice years without posting imported sales again',async()=>{
 const source=salesSource();source.imported=[{id:id(70),issuer_id:id(4),number:'OLD-1',issued_on:'2025-12-01',gross_cents:10000,source_paid_cents:4000,source_open_cents:6000,excluded:false}];source.imported_receipts=[{id:id(71),invoice_id:id(70),amount:60,received_on:'2026-01-10',reference:'NEW-BANK',reversed_at:'2027-01-02T12:00:00Z'}];
 const get=year=>route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year='+year);
 let response=await get(2026);assert.equal(response.status,200);let files=unzip(Buffer.from(await response.arrayBuffer()));assert.match(files['registered-receipt-events.csv'],/archive_receipt/);assert.match(files['registered-receipt-events.csv'],/"60.00"/);assert.doesNotMatch(files['issued-sales-invoices.csv'],/OLD-1/);assert.match(files['imported-invoice-references.csv'],/OLD-1/);assert.equal(JSON.parse(files['manifest.json']).receipt_events,1);
 response=await get(2027);files=unzip(Buffer.from(await response.arrayBuffer()));assert.match(files['registered-receipt-events.csv'],/administrative_reversal/);assert.equal(JSON.parse(files['manifest.json']).invoice_rows,0);
 source.imported_receipts[0].invoice_id=id(99);assert.equal((await get(2026)).status,503);
});
test('accountant ZIP includes issued standalone platform invoices with explicit VAT and receipts',async()=>{
 const source=salesSource();source.services=[{id:id(80),issuer_id:id(4),draft_id:id(81),number:'SERVICE-1',issued_on:'2026-10-29',total:121,net_total:100,vat_total:21,status:'issued'}];source.service_receipts=[{id:id(82),invoice_id:id(80),amount:121,received_on:'2026-10-29',reference:'SERVICE-BANK',reversed_at:null}];
 let r=await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year=2026');assert.equal(r.status,200);let files=unzip(Buffer.from(await r.arrayBuffer()));assert.match(files['issued-sales-invoices.csv'],/standalone_invoice/);assert.match(files['registered-receipt-events.csv'],/service_receipt/);assert.equal(JSON.parse(files['manifest.json']).invoice_rows,2);
 source.services[0].status='draft';r=await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year=2026');assert.equal(r.status,503);
});
test('accountant ZIP exports later-year credits separately with original references and without cash events',async()=>{
 const source=salesSource();source.services=[{id:id(90),draft_id:id(91),issuer_id:id(4),number:'ORIGINAL-2025',issued_on:'2025-12-01',total:121,net_total:100,vat_total:21,status:'issued'}];
 source.credit_notes=[{id:id(92),invoice_id:id(90),issuer_id:id(4),customer_id:id(93),number:'CREDIT-2026',issued_on:'2026-10-29',net_cents:5000,vat_cents:1050,gross_cents:6050,reason:'Synthetic partial correction'}];
 const r=await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year=2026');assert.equal(r.status,200);const files=unzip(Buffer.from(await r.arrayBuffer()));assert.match(files['issued-credit-notes.csv'],/CREDIT-2026/);assert.match(files['issued-credit-notes.csv'],/ORIGINAL-2025/);assert.match(files['issued-credit-notes.csv'],/-60.50/);assert.doesNotMatch(files['issued-sales-invoices.csv'],/ORIGINAL-2025|CREDIT-2026/);const manifest=JSON.parse(files['manifest.json']);assert.equal(manifest.credit_rows,1);assert.equal(manifest.receipt_events,0);
 source.credit_notes[0].invoice_id=id(99);assert.equal((await route('app/admin/workspaces/estates/expenses/sales-export/route.ts',{source}).get('entity='+id(4)+'&year=2026')).status,503);
});
