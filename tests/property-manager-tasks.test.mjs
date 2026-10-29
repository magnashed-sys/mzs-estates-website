import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function load(path){
 if(cache.has(path))return cache.get(path);
 const result={};cache.set(path,result);
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText,{exports:result,FormData,Date,process:{env:{}},require(name){
  if(name==='./property-tasks')return load('lib/property-operations/property-tasks.ts');
  throw Error('Unexpected dependency '+name);
 }});
 return result;
}
const model=load('lib/property-operations/property-tasks.ts');
const validate=load('lib/property-operations/task-input.ts');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function task(n,priority='normal',status='open',due_on='2026-10-29',property=id(1),unit=null){
 return {id:id(n),property_id:property,unit_id:unit,assigned_profile_id:id(2),title:'Synthetic task '+n,
 description:'A synthetic property manager action',priority,status,due_on,source_reference:'',
 created_by:id(3),created_at:'2026-10-28T12:00:00Z',latest_note:null,status_updated_at:null};
}
test('supplier/customer and production are not exposed to the Staging task pilot',()=>{
 const staging={VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',MZS_STAFF_TASKS_ENABLED:'true'};
 assert.equal(model.staffTaskEnvironment(staging),true);
 assert.equal(model.staffTaskEnvironment({...staging,VERCEL_ENV:'production'}),false);
 assert.equal(model.staffTaskEnvironment({...staging,NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'}),false);
 assert.equal(model.staffTaskEnvironment({...staging,MZS_STAFF_TASKS_ENABLED:'false'}),false);
 const prod={VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'};
 assert.equal(model.staffTaskEnvironment(prod),false);
 assert.equal(model.staffTaskEnvironment({...prod,MZS_STAFF_TASKS_REAL_ENABLED:'true'}),true);
 assert.equal(model.staffTaskEnvironment({...prod,VERCEL_ENV:'preview',MZS_STAFF_TASKS_REAL_ENABLED:'true'}),false);
});
test('task and worked-time link require exact physical property plus task-specific unit',()=>{
 const building=task(7,'high','open',null,id(1),null);
 const apartment=task(8,'normal','open',null,id(1),id(5));
 assert.equal(model.validateTaskPlacement(building,{property_id:id(1),unit_id:id(5)}),true);
 assert.equal(model.validateTaskPlacement(apartment,{property_id:id(1),unit_id:id(5)}),true);
 assert.equal(model.validateTaskPlacement(apartment,{property_id:id(1),unit_id:null}),false);
 assert.equal(model.validateTaskPlacement(apartment,{property_id:id(1),unit_id:id(6)}),false);
 assert.equal(model.validateTaskPlacement(apartment,{property_id:id(9),unit_id:id(5)}),false);
});
test('mobile task summary and order account for pending, urgency, blocked and completed records',()=>{
 const tasks=[
  task(1,'low','done','2026-10-25'),
  task(2,'normal','open',null),
  task(3,'urgent','open','2026-10-28'),
  task(4,'high','blocked','2026-10-31'),
  task(5,'low','cancelled',null)
 ];
 const x=model.taskOverview(tasks,'2026-10-29');
 assert.equal(x.open,3);assert.equal(x.today,2);assert.equal(x.urgent,2);
 assert.equal(x.late,1);assert.equal(x.completed,1);
 const sorted=model.taskOrder(tasks);
 assert.equal(sorted[0].id,id(3));assert.equal(sorted.at(-1).status==='cancelled'||sorted.at(-1).status==='done',true);
 assert.equal(tasks[0].id,id(1),'sorting must not mutate source');
});
test('task form validation accepts optional unit, assigned staff and real date only',()=>{
 const f=new FormData();
 f.set('property_id',id(1));f.set('unit_id',id(4));f.set('assigned_profile_id',id(2));
 f.set('title','Inspect shared entry');f.set('description','Inspect the front entrance');
 f.set('priority','normal');f.set('due_on','2026-11-01');f.set('source_reference','');
 const good=validate.taskInput(f);
 assert.equal(good.unit_id,id(4));assert.equal(good.assigned_profile_id,id(2));
 assert.equal(good.due_on,'2026-11-01');
 f.set('due_on','2026-02-30');assert.throws(()=>validate.taskInput(f),/Invalid task fields/);
 f.set('due_on','');f.set('priority','super-urgent');
 assert.throws(()=>validate.taskInput(f),/Invalid priority|Invalid task fields/);
 f.set('priority','urgent');f.set('title','Bad');
 assert.throws(()=>validate.taskInput(f),/Invalid task fields/);
});
test('task updates reject invented statuses and empty notes',()=>{
 const f=new FormData();f.set('task_id',id(1));f.set('status','in_progress');f.set('note','Work started');
 assert.equal(validate.taskUpdateInput(f).status,'in_progress');
 f.set('note','x');assert.throws(()=>validate.taskUpdateInput(f),/Invalid update/);
 f.set('note','A valid note');f.set('status','paid');
 assert.throws(()=>validate.taskUpdateInput(f),/Invalid update/);
});
test('schema has explicit scoped RLS, immutable events, admin audit and optional task-time FK',()=>{
 const sql=readFileSync('supabase/migrations/20261029224500_property_manager_tasks.sql','utf8');
 for(const name of ['mzs_ops_property_tasks','mzs_ops_property_task_updates','mzs_ops_property_task_admin_audit'])
  assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
 assert.match(sql,/create trigger ops_property_task_update_guard/);
 assert.match(sql,/create trigger ops_staff_visit_task_guard/);
 assert.match(sql,/add column task_id uuid references public\.mzs_ops_property_tasks/);
 assert.match(sql,/ops_can_work_on_property_as/);
 assert.match(sql,/grant insert\(property_id,unit_id,assigned_profile_id,title,description,priority,due_on,source_reference\)/);
 const view=readFileSync('supabase/migrations/20261029224600_property_manager_time_task_view.sql','utf8');
 assert.match(view,/v\.task_id/);
 assert.match(view,/security_invoker=true/);
});
