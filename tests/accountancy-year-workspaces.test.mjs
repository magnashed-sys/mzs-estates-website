import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const exports={};modules.set(file,exports);vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,Uint8Array,TextEncoder,Date,FormData,URLSearchParams,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n)});return exports;}
const model=load('lib/accountancy/administration.ts'),pkg=load('lib/accountancy/year-package.ts'),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){return {administration:{id:id(1),issuer_id:id(2),fiscal_year:2026,purpose:'current',vat_treatment:'pending',vat_effective_from:null,vat_evidence:'',notes:'Original notes',checks:Object.fromEntries(Object.keys(model.checkLabels).map(k=>[k,false])),revision:1,updated_at:'2026-10-29T10:00:00Z'},snapshot_at:'2026-10-29T10:00:01Z',sales:{issuer:{id:id(2),name:'Synthetic Estates'},snapshot_at:'2026-10-29T10:00:01Z',leases:[],bookings:[],external:[],services:[],credit_notes:[],rent_receipts:[],guest_receipts:[],external_receipts:[],service_receipts:[],imported_receipts:[],imported:[{id:id(90),issuer_id:id(2),number:'IMPORT-25',issued_on:'2025-01-01',gross_cents:10000,source_paid_cents:5000,source_open_cents:5000,excluded:false},{id:id(91),issuer_id:id(2),number:'IMPORT-26',issued_on:'2026-01-01',gross_cents:20000,source_paid_cents:5000,source_open_cents:15000,excluded:true}]},costs:[0,1,2].map((n)=>({id:id(10+n),legal_entity_id:id(2),invoice_date:'2026-04-10',supplier_relationship_id:id(3),supplier_name:'=NotAFormula',supplier_invoice_number:'COST-'+n,property_id:null,property_name:null,cost_scope:'entity',category:n===0?'advice':'electricity',description:'Original supplier text',net_cents:10000*(n+1),vat_cents:2100*(n+1),gross_cents:12100*(n+1),created_at:'2026-05-01T00:00:00Z',allocations:[{unit_id:null,net_cents:10000*(n+1),vat_cents:2100*(n+1)}],source_document_status:'missing'})),reviews:[{draft_id:id(10),year_id:id(1),category:'advice',project_id:null,review_status:'reviewed',evidence_reference:'Original invoice',note:'',revision:1,updated_at:'2026-06-01T00:00:00Z'},{draft_id:id(12),year_id:id(1),category:'utilities',project_id:null,review_status:'excluded',evidence_reference:'',note:'Wrong source reference',revision:1,updated_at:'2026-06-01T00:00:00Z'}],projects:[],documents:[],capital_references:[]};}
test('year totals separate reviewed/pending/excluded gross amounts without inventing VAT recovery',()=>{const f=fixture(),r=model.annualSummary(model.validateYearSource(f,id(1)));assert.equal(r.reviewedGross,12100);assert.equal(r.pendingGross,24200);assert.equal(r.excludedGross,36300);assert.equal(r.categories.find(x=>x.key==='utilities').pendingGross,24200);assert.equal(r.checksCompleted,0);assert.equal(f.costs[0].vat_cents,2100);});
test('annual source rejects cross-entity/year costs, mismatched project scope and corrupted cents',()=>{for(const change of [s=>s.costs[0].legal_entity_id=id(8),s=>s.costs[0].invoice_date='2025-01-01',s=>s.costs[1].id=s.costs[0].id,s=>s.costs[0].gross_cents++,s=>s.reviews[0].year_id=id(9),s=>s.projects.push({id:id(8),year_id:id(9)}),s=>s.documents.push({issuer_id:id(8),fiscal_year:2026}),s=>s.capital_references.push({entity_id:id(8)}),s=>s.administration.checks.income='yes']){const f=fixture();change(f);assert.throws(()=>model.validateYearSource(f,id(1)));}});
test('consolidated package scopes historical snapshots, retains exclusions and evidence, and hashes every source file',()=>{const f=fixture(),files=pkg.yearAccountantFiles(f,id(1)),text=name=>Buffer.from(files.find(f=>f.name===name).bytes).toString(),manifest=JSON.parse(text('manifest.json'));assert.equal(manifest.statutory_complete,false);assert.equal(manifest.purchase_costs,3);assert.equal(manifest.files.length,files.length-1);for(const entry of manifest.files){const file=files.find(f=>f.name===entry.name);assert.equal(entry.sha256,require('crypto').createHash('sha256').update(file.bytes).digest('hex'));assert.equal(entry.bytes,file.bytes.length);}assert.match(text('supplier-costs.csv'),/'=NotAFormula/);assert.match(text('supplier-costs.csv'),/Wrong source reference/);assert.match(text('annual-review-exceptions.csv'),/vat_treatment_unconfirmed/);assert.match(text('historical-invoice-snapshots.csv'),/IMPORT-26/);assert.doesNotMatch(text('historical-invoice-snapshots.csv'),/IMPORT-25/);assert.doesNotMatch(text('sales/issued-sales-invoices.csv'),/IMPORT-26/);assert.match(text('source-coverage.csv'),/not a bank ledger/);assert.match(text('README.txt'),/ES:/);});
test('cost categorisation handles original utility subcategories and company overhead in existing reports',()=>{assert.equal(model.annualCategory('water'),'utilities');assert.equal(model.annualCategory('advice'),'advice');const r=load('lib/property-operations/cost-report.ts').summarizeConceptCosts(fixture().costs);assert.equal(r.properties[0][0],'company');assert.equal(r.properties[0][1].gross,72600);assert.equal(r.total.count,3);});
test('administration actions authenticate first and reject missing or malformed input before mutations',async()=>{const calls=[],exports={};vm.runInNewContext(ts.transpileModule(readFileSync('app/admin/workspaces/accountancy/administrations/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,FormData,require:n=>n==='next/cache'?{revalidatePath:()=>calls.push('refresh')}:n.includes('estate-properties')?{requireEstateAdmin:async()=>{calls.push('auth');return {db:{from:()=>{calls.push('mutation');throw Error('unexpected')}}}}}:n.includes('administration')?model:n.includes('expense-preview')?load('lib/property-operations/expense-preview.ts'):require(n)});for(const action of ['createYear','saveYear','createProject','saveCostReview','createCost']){calls.length=0;const result=await exports[action](new FormData());assert.equal(result.ok,false);assert.equal(result.code,'invalid');assert.deepEqual(calls,['auth']);}});
test('annual database rules enforce RLS, source immutability, duplicate prevention, review audit and scope',()=>{const r=spawnSync(process.execPath,['tests/db/accountancy-year-workspaces.cjs'],{encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024});assert.equal(r.status,0,r.stdout+r.stderr);});

test('purchase PDF reference and checksum survive edits to the annual review note',()=>{const f=fixture();f.costs[0].source_document_status='retained_purchase_pdf';f.costs[0].source_pdf_id=id(99);f.costs[0].source_pdf_sha256='a'.repeat(64);f.reviews[0].evidence_reference='Changed manual note';const files=pkg.yearAccountantFiles(f,id(1));const csv=Buffer.from(files.find(x=>x.name==='supplier-costs.csv').bytes).toString();assert.ok(csv.includes(id(99)));assert.ok(csv.includes('a'.repeat(64)));assert.ok(csv.includes('Changed manual note'));});
test('retained archive PDFs export each invoice association without inventing payments',()=>{const f=fixture();f.costs[0].source_document_status='retained_archive_pdf';f.costs[0].archive_documents=[{id:id(90),title:'Combined supplier original',sha256:'b'.repeat(64),review_status:'pending_review'}];f.costs[1].archive_documents=f.costs[0].archive_documents;const files=pkg.yearAccountantFiles(f,id(1)),text=n=>Buffer.from(files.find(x=>x.name===n).bytes).toString();assert.equal(text('supplier-document-links.csv').split(id(90)).length-1,2);assert.ok(text('supplier-document-links.csv').includes('b'.repeat(64)));assert.doesNotMatch(text('annual-review-exceptions.csv'),new RegExp(f.costs[0].id+',original_document_not_attached'));assert.match(text('supplier-costs.csv'),/false/);});

test('annual accountant export includes one source-evidence row per supplier invoice, with actionable issues and no payment inference',()=>{
 const f=fixture();
 f.costs[0].archive_documents=[{id:id(96),title:'Retained original',sha256:'b'.repeat(64),review_status:'pending_review'}];
 const files=pkg.yearAccountantFiles(f,id(1));
 const csv=Buffer.from(files.find(file=>file.name==='supplier-evidence-actions.csv').bytes).toString();
 const lines=csv.trim().split(/\r?\n/);
 assert.equal(lines.length,4,'header plus three supplier costs');
 assert.ok(csv.includes('supplier_invoice_number'));
 assert.ok(csv.includes('issue_codes'));
 assert.match(csv,/private_archive/);
 assert.match(csv,/archive_pending_review/);
 assert.match(csv,/missing_original/);
 assert.match(csv,/not_assessed/);
 assert.ok(files.some(file=>file.name==='source-coverage.csv'));
 assert.equal(JSON.parse(Buffer.from(files.find(file=>file.name==='manifest.json').bytes).toString()).statutory_complete,false);
});

test('private year export includes master-data QA once per referenced existing supplier, without supplier writes',()=>{
 const f=fixture(),master=[
  {id:id(3),name:'=NotAFormula',kind:'company',company_details:{tax_id:'ESB12345678'}},
  {id:id(97),name:'Secondary supplier spelling',kind:'company',company_details:{tax_id:'ES B12345678'}},
  {id:id(98),name:'Unrelated company',kind:'company',company_details:{tax_id:'ESB98765432'}}
 ];
 const files=pkg.yearAccountantFiles(f,id(1),master),out=n=>Buffer.from(files.find(x=>x.name===n).bytes).toString();
 const csv=out('supplier-masterdata-review.csv'),lines=csv.trim().split(/\r?\n/);
 assert.equal(lines.length,2,'one header and one master-data row despite three invoice drafts');
 assert.match(csv,/company_tax_id/);
 assert.match(csv,/ESB12345678/);
 assert.match(csv,/same_tax_id/);
 assert.match(csv,new RegExp(id(97)));
 assert.doesNotMatch(csv,/Unrelated company/);
 assert.match(out('README.txt'),/Supplier master-data warnings/);
 const manifest=JSON.parse(out('manifest.json'));
 assert.ok(manifest.files.some(file=>file.name==='supplier-masterdata-review.csv'));
 assert.equal(manifest.statutory_complete,false);
});

test('accountant ZIP exports supplier invoice metadata controls with explicit payment verification unavailable',()=>{
 const f=fixture();
 f.costs[0].archive_documents=[{id:id(70),title:'Supplier PDF',sha256:'e'.repeat(64),
  category:'supplier_invoice',document_date:'2026-04-11',review_status:'reviewed'}];
 f.costs[1].archive_documents=[{id:id(71),title:'Bank evidence',sha256:'f'.repeat(64),
  category:'other',document_date:null,review_status:'reviewed'}];
 const files=pkg.yearAccountantFiles(f,id(1));
 const csv=Buffer.from(files.find(v=>v.name==='supplier-invoice-control.csv').bytes).toString();
 assert.equal(csv.trim().split(/\r?\n/).length,4,'one header and three purchase invoices, including excluded one');
 assert.match(csv,/archive_date_differs/);
 assert.match(csv,/archive_not_supplier_invoice/);
 assert.match(csv,/not_reconciled_no_supplier_payment_ledger/);
 assert.match(csv,/manual_comparison_required/);
 assert.match(csv,/not_assessed/);
 assert.doesNotMatch(csv,/\b(unpaid|overdue|paid)\b/i);
 const readme=Buffer.from(files.find(v=>v.name==='README.txt').bytes).toString();
 assert.match(readme,/supplier-invoice-control.csv/);
 assert.match(readme,/bank payments must be independently verified/);
 const manifest=JSON.parse(Buffer.from(files.find(v=>v.name==='manifest.json').bytes).toString());
 assert.equal(manifest.statutory_complete,false);
 assert.ok(manifest.files.some(v=>v.name==='supplier-invoice-control.csv'));
});

test('pilot supplier payment export preserves partial, reversed, unreconciled events and statutory=false',()=>{
 const f=fixture(),draft=f.costs[0];
 const events=[
  {id:id(45),draft_id:draft.id,issuer_id:draft.legal_entity_id,amount_cents:4000,paid_on:'2026-10-20',reference:'SYNTH-RECEIPT-A',recorded_by:id(10),created_at:'2026-10-21T00:00:00Z',reversed_at:null,reversed_by:null,reversal_reason:null},
  {id:id(46),draft_id:draft.id,issuer_id:draft.legal_entity_id,amount_cents:2000,paid_on:'2026-10-20',reference:'SYNTH-RECEIPT-B',recorded_by:id(10),created_at:'2026-10-21T00:00:00Z',reversed_at:'2026-10-22T00:00:00Z',reversed_by:id(10),reversal_reason:'Invalid original registration'}
 ];
 const files=pkg.yearAccountantFiles(f,id(1),[],events);
 const csv=name=>Buffer.from(files.find(x=>x.name===name).bytes).toString();
 assert.equal(csv('supplier-payment-events.csv').trim().split(/\r?\n/).length,3);
 assert.match(csv('supplier-payment-events.csv'),/administratively_reversed/);
 assert.match(csv('supplier-payment-events.csv'),/administratively_recorded/);
 assert.match(csv('supplier-payment-summary.csv'),/not_verified/);
 assert.match(csv('supplier-payment-summary.csv'),/81.00/);
 assert.match(csv('supplier-payment-summary.csv'),/40.00/);
 assert.doesNotMatch(csv('supplier-payment-summary.csv'),/\b(unpaid|overdue)\b/);
 assert.match(csv('README.txt'),/NOT bank reconciliation/);
 assert.equal(JSON.parse(csv('manifest.json')).statutory_complete,false);
 const noPilot=pkg.yearAccountantFiles(f,id(1));
 assert.equal(noPilot.some(x=>x.name==='supplier-payment-events.csv'),false);
});
