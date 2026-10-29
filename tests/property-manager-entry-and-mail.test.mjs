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
