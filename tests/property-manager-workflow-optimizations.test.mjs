import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=path=>readFileSync(path,'utf8');

test('task updates refresh and important tasks can be filtered on mobile',()=>{
 const board=read('app/staff/StaffTaskBoard.tsx');
 assert.ok(board.includes("if(state.status==='success')router.refresh()"));
 assert.ok(board.includes("if(taskState.status==='success')router.refresh()"));
 assert.ok(board.includes("filter==='high'"));
 assert.ok(board.includes('summary.urgent'));
 assert.ok(board.includes("'/staff?task='+encodeURIComponent(task.id)+'#hours'"));
 assert.ok(board.includes('logTimeForTask'));
});
test('time prefill is scoped to assigned property tasks and clears on unit change',()=>{
 const page=read('app/staff/page.tsx');
 const form=read('app/staff/StaffForms.tsx');
 assert.ok(page.includes("tasks.some(t=>t.id===requestedTask)"));
 assert.ok(page.includes('initialTaskId={initialTaskId}'));
 assert.ok(form.includes('assignedTasks.find(task=>task.id===initialTaskId)'));
 assert.ok(form.includes("setPropertyId(selected.property_id);setUnitId(selected.unit_id??'')"));
 assert.ok(form.includes("setUnitId(e.target.value);setTaskId('')"));
 assert.ok(form.includes('name="task_id" value={taskId}'));
});
test('failed photo upload is a warning and a saved report can be opened',()=>{
 const board=read('app/staff/StaffTaskBoard.tsx');
 assert.ok(board.includes("status:uploaded===files.length?'success':'warning'"));
 assert.ok(board.includes("setPhotoProgress(t('photoProgress')"));
 assert.ok(board.includes('setLastTicketId(ticketId)'));
 assert.ok(board.includes("'/staff?ticket='+encodeURIComponent(lastTicketId)+'#ticket'"));
});
test('recent maintenance and authenticated image thumbnails preserve private route',()=>{
 const page=read('app/staff/page.tsx');
 const photos=read('app/staff/PhotoPanel.tsx');
 assert.ok(page.includes('data.tickets.rows.slice(0,3)'));
 assert.ok(page.includes('open={!!data.ticket||!!data.visit}'));
 assert.ok(photos.includes('unoptimized loading="lazy"'));
 assert.ok(photos.includes("'/api/staff/maintenance-photo/'+p.id"));
 assert.ok(!photos.includes('getPublicUrl'));
});
