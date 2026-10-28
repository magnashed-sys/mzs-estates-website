import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const filename='lib/property-operations/financial-summary.ts';
const source=readFileSync(new URL('../'+filename,import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{},Map,Set,Date,Number,String,Error};
vm.runInNewContext(js,sandbox);
const {buildOpsCostSummary}=sandbox.exports;
const company='11111111-1111-4111-8111-111111111111';
const privatePerson='22222222-2222-4222-8222-222222222222';
const property1='33333333-3333-4333-8333-333333333333';
const property2='44444444-4444-4444-8444-444444444444';
const sha='a'.repeat(64);
function draft(id,entity=company,month='2026-10',net=10000,vat=2100,prop=property1){
 return {id,property_id:prop,legal_entity_id:entity,invoice_date:month+'-15',
  net_cents:net,vat_cents:vat,gross_cents:net+vat,category:'cleaning'};
}
function seed(){
 const ids=['old','replacement','pending','rejected','private','other-month','other-year'];
 return {
  year:2026,entityId:'all',
  drafts:[
   draft(ids[0]),draft(ids[1],company,'2026-11',12000,2520),
   draft(ids[2]),draft(ids[3]),draft(ids[4],privatePerson,'2026-10',2000,0,property2),
   draft(ids[5],company,'2026-12',6000,0),draft(ids[6],company,'2025-12',500,0)
  ],
  documents:['old','replacement','rejected','private','other-month','other-year'].map(id=>({
    id:'doc-'+id,draft_id:id,sha256:sha
  })),
  reviews:[
   {id:'rev-old',draft_id:'old',sequence_no:1,action:'approved'},
   {id:'rev-replacement',draft_id:'replacement',sequence_no:1,action:'approved'},
   {id:'rev-pending',draft_id:'pending',sequence_no:1,action:'submitted'},
   {id:'rev-rejected',draft_id:'rejected',sequence_no:1,action:'rejected'},
   {id:'rev-private',draft_id:'private',sequence_no:1,action:'approved'},
   {id:'rev-other',draft_id:'other-month',sequence_no:1,action:'approved'},
   {id:'rev-oldyear',draft_id:'other-year',sequence_no:1,action:'approved'}
  ],
  corrections:[{id:'corr-1',draft_id:'old'}],
  decisions:[{id:'decision-1',correction_id:'corr-1',decision:'replacement_required'}],
  replacements:[{id:'replacement-link-1',correction_id:'corr-1',replacement_draft_id:'replacement'}]
 };
}
test('only approved independent originals count; replaced old cost and unreviewed excluded',()=>{
 const a=buildOpsCostSummary(seed());
 assert.equal(a.approved.count,3);
 assert.equal(a.approved.netCents,20000);
 assert.equal(a.approved.vatCents,2520);
 assert.equal(a.approved.grossCents,22520);
 assert.equal(a.pending.count,1);
 assert.equal(a.attention.count,2);
 assert.equal(a.months.find(m=>m.month==='2026-10').approvedGrossCents,2000);
 assert.equal(a.months.find(m=>m.month==='2026-11').approvedGrossCents,14520);
 assert.equal(a.months.find(m=>m.month==='2026-12').approvedGrossCents,6000);
 assert.equal(a.cashPaidKnown,false);
 assert.equal(a.completeness,'verified-registers');
});
test('per entity and year never brings private costs into company totals',()=>{
 const s=seed();
 assert.equal(buildOpsCostSummary({...s,entityId:company}).approved.grossCents,20520);
 assert.equal(buildOpsCostSummary({...s,entityId:privatePerson}).approved.grossCents,2000);
 assert.equal(buildOpsCostSummary({...s,entityId:'unassigned'}).approved.grossCents,0);
 assert.equal(buildOpsCostSummary({...s,entityId:company,year:2025}).approved.grossCents,500);
});
test('declined correction retains original approved amount; replacement required excludes it',()=>{
 const s=seed();
 s.decisions=[{id:'decision-1',correction_id:'corr-1',decision:'declined'}];
 s.replacements=[];
 assert.equal(buildOpsCostSummary(s).approved.grossCents,34620);
 s.decisions=[];
 assert.equal(buildOpsCostSummary(s).approved.grossCents,22520);
});
test('invalid money, orphan evidence, missing approval document and duplicate lineage fail closed',()=>{
 const s=seed();
 assert.throws(()=>buildOpsCostSummary({...s,documents:s.documents.filter(d=>d.draft_id!=='private')}),/lacks original/);
 assert.throws(()=>buildOpsCostSummary({...s,documents:[...s.documents,{id:'fake',draft_id:'unknown',sha256:sha}]}),/Unexpected/);
 assert.throws(()=>buildOpsCostSummary({...s,drafts:[...s.drafts,s.drafts[0]]}),/Duplicate/);
 assert.throws(()=>buildOpsCostSummary({...s,replacements:[...s.replacements,s.replacements[0]]}),/Duplicate/);
 assert.throws(()=>buildOpsCostSummary({...s,drafts:s.drafts.map(d=>d.id==='replacement'?{...d,gross_cents:14400}:d)}),/Invalid cost invoice/);
});
test('cockpit integration leaves existing net-cashflow formulas and production source untouched',()=>{
 const fc=readFileSync(new URL('../app/admin/FinancialCockpit.tsx',import.meta.url),'utf8');
 const api=readFileSync(new URL('../app/api/admin/property-operations-costs/route.ts',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../app/admin/PropertyOperationsFinancialPanel.tsx',import.meta.url),'utf8');
 assert.match(fc,/PropertyOperationsFinancialPanel/);
 assert.match(fc,/NEXT_PUBLIC_SUPABASE_URL==='https:\/\/senonkpxdtlhyhrubicg.supabase.co'/);
 assert.match(api,/VERCEL_ENV!=="preview"/);
 assert.match(api,/await requireEstateAdmin\(\)/);
 assert.match(api,/mzs_ops_expense_drafts/);
 assert.match(api,/mzs_ops_expense_correction_decisions/);
 assert.match(api,/mzs_ops_expense_replacements/);
 assert.match(api,/Incomplete source pagination/);
 assert.match(api,/No partial totals are shown/);
 assert.match(panel,/cashPaidKnown!==false/);
 assert.match(panel,/not subtracted from the existing/);
 assert.doesNotMatch(api,/\bservice_role\b|sendMail\(|mzs_lease_invoices|mzs_capital_payments|\.insert\(|\.update\(/);
});
