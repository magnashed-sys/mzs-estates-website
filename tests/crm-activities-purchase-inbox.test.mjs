import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function load(file){
 const output=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exported={};vm.runInNewContext(output,{exports:exported,Date,Number,FormData,URLSearchParams});
 return exported;
}
const crm=load('lib/relationships/crm-activities.ts');
const purchase=load('lib/accountancy/purchase-review.ts');
function form(rows){const f=new FormData();for(const [k,v] of Object.entries(rows))f.set(k,v);return f;}
const ID='11111111-1111-4111-8111-111111111111';

test('CRM contact notes remain completed immediately and cannot silently become tasks',()=>{
 const base={relationship_id:ID,kind:'note',title:'Discussed renovation budget',detail:'Client called to confirm next steps.',due_on:''};
 assert.equal(crm.crmNewActivity(form(base)).status,'done');
 assert.equal(crm.crmNewActivity(form(base)).due_on,null);
 assert.throws(()=>crm.crmNewActivity(form({...base,due_on:'2026-11-19'})),/CRM activity/);
 assert.throws(()=>crm.crmNewActivity(form({...base,relationship_id:'bad'})),/CRM activity/);
 assert.throws(()=>crm.crmNewActivity(form({...base,kind:'approve'})),/CRM activity/);
});

test('CRM tasks validate real calendar dates and cannot be overwritten with stale updates',()=>{
 const task={relationship_id:ID,kind:'task',title:'Follow up with client',detail:'',due_on:'2026-11-20'};
 const row=crm.crmNewActivity(form(task));
 assert.equal(row.status,'open');assert.equal(row.due_on,'2026-11-20');
 assert.throws(()=>crm.crmNewActivity(form({...task,due_on:'2026-02-30'})),/date/);
 assert.throws(()=>crm.crmNewActivity(form({...task,title:'X'})),/CRM activity/);
 const update=crm.crmUpdateTask(form({id:ID,revision:'3',status:'done',due_on:'2026-11-20'}));
 assert.equal(update.revision,3);assert.equal(update.status,'done');
 assert.throws(()=>crm.crmUpdateTask(form({id:ID,revision:'0',status:'done',due_on:''})),/task/);
 assert.throws(()=>crm.crmUpdateTask(form({id:ID,revision:'1',status:'deleted',due_on:''})),/task/);
});

test('CRM summary distinguishes overdue open tasks from completed tasks and immutable contact moments',()=>{
 const fixtures=[
  {id:'a',kind:'task',status:'open',due_on:'2026-11-08'},
  {id:'b',kind:'task',status:'open',due_on:'2026-11-15'},
  {id:'c',kind:'task',status:'done',due_on:'2026-11-01'},
  {id:'d',kind:'note',status:'done',due_on:null},
  {id:'e',kind:'meeting',status:'done',due_on:null}
 ];
 const result=crm.crmActivitySummary(fixtures,'2026-11-09');
 assert.equal(result.open,2);assert.equal(result.overdue,1);
 assert.equal(result.completed,1);assert.equal(result.contacts,2);
});

test('Purchase review queue reuses source completeness and prioritizes original PDFs before duplicates',()=>{
 const inputs=[
  {id:'supplier:1',group:'suppliers',label:'Supplier check',issues:['supplier_duplicate_check'],href:'/admin/relationships'},
  {id:'cost:1',group:'documents',label:'Invoice A',issues:['missing_original','possible_double_entry'],href:'/admin/workspaces/accountancy/attachments'},
  {id:'cost:2',group:'review',label:'Invoice B',issues:['possible_double_entry'],href:'/admin/workspaces/accountancy/administrations/a'},
  {id:'cost:3',group:'review',label:'Invoice C',issues:['cost_pending_review'],href:'/admin/workspaces/accountancy/administrations/b'},
  {id:'document:1',group:'documents',label:'Annual accounts',issues:['archive_pending_review'],href:'/admin/documents'},
  {id:'check:income',group:'review',label:'Income checklist',issues:['checklist_pending'],href:'/admin'}
 ];
 const rows=purchase.purchaseReviewItems(inputs),counts=purchase.purchaseReviewCounts(rows);
 assert.deepEqual(Array.from(rows.map(x=>x.id)),['cost:1','cost:2','supplier:1','cost:3']);
 assert.deepEqual({...counts},{total:4,originals:1,duplicates:2,suppliers:0,review:1});
 assert.ok(!rows.some(x=>x.id.startsWith('document:')||x.id.startsWith('check:')));
});

test('CRM migration requires admin RLS, controlled audited writes, and immutable linked history',()=>{
 const ddl=read('supabase/migrations/20261109103000_crm_activities.sql');
 assert.match(ddl,/references public\.mzs_lease_relationships\(id\) on delete restrict/);
 assert.match(ddl,/enable row level security/);
 assert.match(ddl,/using \(public\.is_admin\(\)\)/);
 assert.match(ddl,/with check\(public\.is_admin\(\)\)/);
 assert.match(ddl,/grant update\(status,due_on,version\)/);
 assert.match(ddl,/new\.version<>old\.version\+1/);
 assert.match(ddl,/Source fields are immutable/gi.test(ddl)?/Source fields are immutable/:/CRM source fields are immutable/);
 assert.match(ddl,/mzs_crm_activity_events/);
 assert.doesNotMatch(ddl,/grant (?:delete|truncate)/i);
});

test('CRM follow-ups and purchase review remain restricted to administrator routes',()=>{
 const crmPage=read('app/admin/relationships/activities/page.tsx');
 const crmActions=read('app/admin/relationships/activities/actions.ts');
 const purchasePage=read('app/admin/workspaces/accountancy/purchase-inbox/page.tsx');
 assert.match(crmPage,/await requireEstateAdmin\(\)/);
 assert.match(crmActions,/await requireEstateAdmin\(\)/);
 assert.match(purchasePage,/await requireEstateAdmin\(\)/);
 assert.match(crmActions,/\.eq\('version',payload\.revision\)/);
 assert.match(crmActions,/\.eq\('kind','task'\)/);
 assert.match(crmActions,/revalidatePath\('\/admin\/relationships\/activities'\)/);
 assert.match(purchasePage,/purchaseReviewItems\(completenessItems\(source,suppliers\)\)/);
 assert.match(purchasePage,/allRows<Year>/);
 assert.match(purchasePage,/No invoice is approved, paid, booked, imported or deleted from this inbox/);
 assert.match(read('app/admin/workspaces/accountancy/page.tsx'),/href="\/admin\/workspaces\/accountancy\/purchase-inbox"/);
 assert.match(read('app/admin/relationships/RelationshipRegister.tsx'),/href="\/admin\/relationships\/activities"/);
});
