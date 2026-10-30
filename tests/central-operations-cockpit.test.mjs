import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync('lib/property-operations/operations-cockpit.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,Date,Intl});
const snapshot=exports.operationsSnapshot;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const task=(n,fields={})=>({
 id:id(n),property_id:id(11),work_area_id:null,unit_id:null,assigned_profile_id:id(51),
 title:'Sample task '+n,description:'',priority:'normal',due_on:null,source_reference:'',
 created_by:id(51),created_at:'2026-10-28T00:00:00Z',status:'open',latest_note:null,status_updated_at:null,...fields
});
const ticket=(n,fields={})=>({id:id(n),property_id:id(11),unit_id:null,
 title:'Repair '+n,priority:'routine',status:'reported',scheduled_for:null,
 responsible_profile_id:null,created_at:'2026-10-29T12:00:00Z',latest_note:null,...fields});
const visit=(n,fields={})=>({id:id(n),profile_id:id(51),property_id:id(11),work_area_id:null,
 worked_on:'2026-10-29',effective_minutes:60,description:'Synthetic visit',
 review_decision:null,correction_pending:false,...fields});
const model=(extra={})=>({
 today:'2026-10-30',properties:[{id:id(11),name:'IJmuiden building'}],
 areas:[{id:'private-magdy',name:'Prive Magdy'}],
 units:[{id:id(21),address:'Office A'}],people:[{id:id(51),full_name:'Worker A'}],
 tasks:[],tickets:[],visits:[],notes:[],...extra
});
test('Operations Cockpit separates overdue, blocked, unassigned and high priority tasks and sorts attention first',()=>{
 const x=snapshot(model({tasks:[
  task(101,{due_on:'2026-10-29'}),
  task(102,{status:'blocked',work_area_id:'private-magdy',property_id:null,assigned_profile_id:id(51)}),
  task(103,{priority:'high',due_on:'2026-11-02'}),
  task(104,{assigned_profile_id:null}),
  task(105,{status:'done'}),
  task(106,{status:'cancelled'})
 ]}));
 assert.equal(x.summary.taskOpen,4);
 assert.equal(x.summary.taskOverdue,1);
 assert.equal(x.summary.taskBlocked,1);
 assert.equal(x.summary.taskUnassigned,1);
 assert.equal(x.summary.taskHigh,1);
 assert.equal(x.tasks[0].id,id(101));
 assert.ok(x.tasks.some(a=>a.location==='Prive Magdy'&&a.subtitle==='Blocked'));
 assert.ok(x.tasks.every(a=>!a.href.includes('javascript:')));
});
test('maintenance readiness and blockage use last immutable note but never claim official status transition',()=>{
 const x=snapshot(model({
  tickets:[ticket(201),ticket(202),ticket(203,{status:'scheduled',scheduled_for:'2026-10-28'}),ticket(204,{status:'closed'})],
  notes:[
   {id:id(301),ticket_id:id(201),note_kind:'blocked',note:'Waiting for access',created_at:'2026-10-29T01:00:00Z'},
   {id:id(302),ticket_id:id(201),note_kind:'ready_for_review',note:'All work done',created_at:'2026-10-30T01:00:00Z'},
   {id:id(303),ticket_id:id(202),note_kind:'blocked',note:'Parts unavailable',created_at:'2026-10-30T00:00:00Z'}
  ]
 }));
 assert.equal(x.summary.maintenanceOpen,3);
 assert.equal(x.summary.maintenanceTriage,2);
 assert.equal(x.summary.maintenanceOverdue,1);
 assert.equal(x.summary.maintenanceReady,1);
 assert.equal(x.summary.maintenanceBlocked,1);
 assert.ok(x.maintenance.find(a=>a.id===id(201)).subtitle==='Ready for review');
 assert.ok(x.maintenance.find(a=>a.id===id(202)).subtitle==='Staff blocked');
});
test('time reviews include special work areas separately; corrections are not counted as pending twice',()=>{
 const x=snapshot(model({visits:[
  visit(401,{property_id:null,work_area_id:'private-magdy',effective_minutes:45}),
  visit(402,{correction_pending:true}),
  visit(403,{review_decision:'approved'}),
  visit(404,{review_decision:'rejected'})
 ]}));
 assert.equal(x.summary.timePending,1);
 assert.equal(x.summary.timeCorrection,1);
 assert.equal(x.summary.timeTotalMinutes,225);
 assert.equal(x.time[0].location,'Prive Magdy');
 assert.equal(x.time[0].kind,'time');
 assert.equal(x.corrections[0].id,id(402));
 assert.match(x.time[0].href,/staff\?visit=/);
});
test('invalid locations are rejected instead of silently replacing counts',()=>{
 assert.throws(()=>snapshot(model({tasks:[task(501,{work_area_id:'private-magdy',property_id:null}),
  task(502,{property_id:null,work_area_id:'missing-area'})]})),/Unknown assigned work location/);
 assert.throws(()=>snapshot(model({today:'2026/10/30'})),/Invalid operations day/);
});
test('central admin page is guarded, dynamic, exact and links to existing scoped records',()=>{
 const page=readFileSync('app/admin/workspaces/estates/operations/page.tsx','utf8');
 const q=readFileSync('lib/property-operations/action-queues.ts','utf8');
 const nav=readFileSync('app/admin/workspaces/WorkspaceNavigation.tsx','utf8');
 assert.match(page,/requireStaffEnvironment\(\)/);
 assert.match(page,/requireEstateAdmin\(\)/);
 assert.match(page,/export const dynamic='force-dynamic'/);
 assert.match(page,/allRows<PropertyTask>/);
 assert.match(page,/loadQueueCounts\(db,today\)/);
 assert.match(page,/operationsSnapshot/);
 assert.match(page,/queueHref\('corrections'\)/);
 assert.match(q,/visits:'id,property_id,work_area_id/);
 assert.match(q,/const areaNames=new Map/);
 assert.ok(nav.includes('if(matches("/admin/workspaces/estates/operations"))return "Staff"'));
 const staff=readFileSync('app/admin/workspaces/staff/page.tsx','utf8');
 assert.ok(staff.includes('href="/admin/workspaces/estates/operations"'));
});
