import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const file=path=>readFileSync(path,'utf8');

test('login keeps capital precedence and routes only scoped staff into the work dashboard',()=>{
 const login=file('app/login/page.tsx');
 assert.match(login,/capitalScope === true/);
 assert.match(login,/fetch\("\/api\/private\/staff-access"/);
 assert.match(login,/propertyManager\s*\?\s*"\/staff"\s*:\s*"\/private"/);
 assert.doesNotMatch(login,/email\.trim\(\)\s*===\s*["']magdy@mzsgroup\.eu/);
});

test('only property manager task creation queues staff email; admin does not trigger it',()=>{
 const sql=file('supabase/migrations/20261029235500_property_staff_task_notification.sql');
 assert.match(sql,/after insert on public\.mzs_ops_property_tasks/);
 assert.match(sql,/new\.created_by is distinct from new\.assigned_profile_id/);
 assert.match(sql,/mzs_private\.ops_can_work_on_property_as/);
 assert.match(sql,/recipient\.email\) = 'magdy@mzsgroup\.eu'/);
 assert.match(sql,/on conflict \(idempotency_key\) do nothing/);
 assert.doesNotMatch(file('app/admin/workspaces/estates/staff/tasks/actions.ts'),/deliverPropertyStaffTaskNotice/);
});

test('staff task sends best-effort email only after saved insert with scheduled retry fallback',()=>{
 const task=file('app/staff/task-actions.ts');
 assert.match(task,/\.insert\(payload\)\.select\('id'\)\.single\(\)/);
 assert.match(task,/after\(async\(\)=>\{await deliverPropertyStaffTaskNotice\(created\.id\);\}\)/);
 const mail=file('lib/mzs/notifications.ts');
 assert.match(mail,/event\.event_type === "property_staff_task_created"/);
 assert.match(mail,/profile\.email\.toLowerCase\(\) !== "magdy@mzsgroup\.eu"/);
 assert.match(mail,/NEXT_PUBLIC_SUPABASE_URL!=="https:\/\/ptrnjzmcehrhbsfxntgw\.supabase\.co"/);
 assert.match(mail,/\.contains\("payload",\{task_id:taskId\}\)/);
 assert.match(mail,/"\/admin\/workspaces\/estates\/staff\/tasks"/);
});

test('mobile staff has one intake for tasks and maintenance with both secured existing actions',()=>{
 const board=file('app/staff/StaffTaskBoard.tsx');
 const staffPage=file('app/staff/page.tsx');
 const forms=file('app/staff/StaffForms.tsx');
 assert.match(board,/function NewWorkItem/);
 assert.match(board,/useActionState\(createMyPropertyTask,initial\)/);
 assert.match(board,/\/api\/staff\/report-with-photos/);
 assert.match(board,/action=\{isMaintenance\?undefined:taskAction\}/);
 assert.match(board,/t\('maintenance'\)/);
 assert.match(board,/name="priority" defaultValue=\{isMaintenance\?'routine':'normal'\}/);
 assert.match(board,/<option value="soon">\{t\('soon'\)\}<\/option>/);
 assert.match(board,/<option value="urgent">\{t\('urgent'\)\}<\/option>/);
 assert.match(board,/required=\{isMaintenance\}/);
 assert.match(board,/const value='property:'\+p\.id/);
 assert.match(board,/const value='area:'\+area\.id/);
 assert.match(board,/name="assigned_profile_id" value=\{profileId\}/);
 assert.match(staffPage,/showMaintenanceForm=\{!taskEnabled\}/);
 assert.match(forms,/props\.showMaintenanceForm!==false&&<MaintenanceForm/);
 assert.doesNotMatch(board,/<NewTask/);
 assert.doesNotMatch(board,/href="#task-create"/);
});

test('backend guards still separate maintenance reports from tasks and invoices',()=>{
 const actions=file('app/staff/actions.ts');
 const taskActions=file('app/staff/task-actions.ts');
 assert.match(actions,/from\("mzs_ops_maintenance_tickets"\)\.insert/);
 assert.match(actions,/\["routine","soon","urgent"\]/);
 assert.match(taskActions,/from\('mzs_ops_property_tasks'\)/);
 assert.match(actions,/This is no payroll|geen werkopdracht|nog geen werkopdracht/i);
});

test('staff task emails use immutable, trusted outbox snapshot without broad service-role grants',()=>{
 const sql=file('supabase/migrations/20261030002000_property_task_mail_snapshot.sql');
 assert.match(sql,/create or replace function mzs_private\.queue_property_staff_task_notice/);
 assert.match(sql,/jsonb_build_object\(\s*'task_id',new\.id/);
 assert.match(sql,/'property',v_property/);
 assert.match(sql,/o\.status='pending'/);
 assert.match(sql,/not o\.payload \? 'title'/);
 assert.match(sql,/recipient\.email\)='magdy@mzsgroup\.eu'/);
 assert.doesNotMatch(sql,/grant select on public\.(mzs_ops_property_tasks|mzs_estate_properties|mzs_estate_units) to service_role/i);
 const mail=file('lib/mzs/notifications.ts');
 const from=mail.lastIndexOf('if (event.event_type === "property_staff_task_created")');
 const to=mail.indexOf('if (event.event_type === "capital_access_granted")',from);
 assert.ok(from>0 && to>from);
 const branch=mail.slice(from,to);
 assert.match(branch,/snapshot is incomplete/);
 assert.doesNotMatch(branch,/from\("mzs_ops_property_tasks"\)|from\("mzs_estate_properties"\)|from\("mzs_estate_units"\)/);
 assert.match(mail,/stage: deliveryStage/);
});
