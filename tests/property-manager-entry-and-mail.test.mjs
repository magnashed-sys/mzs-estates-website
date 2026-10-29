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
 assert.match(board,/useActionState\(reportMaintenanceTicket,initial\)/);
 assert.match(board,/action=\{isMaintenance\?maintenanceAction:taskAction\}/);
 assert.match(board,/Maintenance issue \/ repair request/);
 assert.match(board,/name="priority" defaultValue=\{isMaintenance\?'routine':'normal'\}/);
 assert.match(board,/<option value="soon">Needs attention soon<\/option>/);
 assert.match(board,/<option value="urgent">Urgent<\/option>/);
 assert.match(board,/required=\{isMaintenance\}/);
 assert.match(board,/properties\.length>1/);
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
