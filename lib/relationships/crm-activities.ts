/** Admin-only CRM activity validation. No user-supplied SQL, roles or login permissions. */
export const CRM_ACTIVITY_KINDS=['note','call','email','meeting','task'] as const;
export type CrmActivityKind=typeof CRM_ACTIVITY_KINDS[number];
export const CRM_TASK_STATES=['open','done'] as const;
export type CrmActionResult={status:'idle'|'success'|'error';message:string};

const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const crmUuid=(value:string)=>uuid.test(value);
const input=(form:FormData,key:string)=>{
 const value=form.get(key);
 if(typeof value!=='string')throw Error('Complete the required CRM fields.');
 return value.trim();
};
export function crmDueDate(raw:string):string|null{
 if(!raw)return null;
 if(!/^20\d{2}-(0[1-9]|1[0-2])-[0-3]\d$/.test(raw))throw Error('Enter a valid due date.');
 const date=new Date(raw+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==raw)throw Error('Enter a valid due date.');
 return raw;
}
export function crmNewActivity(form:FormData){
 const relationship_id=input(form,'relationship_id');
 const kind=input(form,'kind');
 const title=input(form,'title');
 const detail=input(form,'detail');
 const due_on=crmDueDate(input(form,'due_on'));
 if(!crmUuid(relationship_id)||!(CRM_ACTIVITY_KINDS as readonly string[]).includes(kind)||
    title.length<3||title.length>180||/[\x00-\x1f\x7f]/.test(title)||
    detail.length>4000||detail.includes('\x00')||
    (kind!=='task'&&due_on))throw Error('Check the CRM activity and linked relationship.');
 return {relationship_id,kind:kind as CrmActivityKind,title,detail,due_on,
   status:kind==='task'?'open' as const:'done' as const};
}
export function crmUpdateTask(form:FormData){
 const id=input(form,'id'),revision=Number(input(form,'revision'));
 const status=input(form,'status'),due_on=crmDueDate(input(form,'due_on'));
 if(!crmUuid(id)||!Number.isSafeInteger(revision)||revision<1||
    !(CRM_TASK_STATES as readonly string[]).includes(status))throw Error('Refresh the task and check the update.');
 return {id,revision,status:status as typeof CRM_TASK_STATES[number],due_on};
}
export type CrmActivity={
 id:string;relationship_id:string;kind:CrmActivityKind;title:string;detail:string;
 due_on:string|null;status:'open'|'done';version:number;created_by:string;
 created_at:string;updated_at:string;completed_at:string|null;
};
export function crmActivitySummary(rows:readonly CrmActivity[],today:string){
 const tasks=rows.filter(r=>r.kind==='task');
 return {contacts:rows.length-tasks.length,open:tasks.filter(x=>x.status==='open').length,
   overdue:tasks.filter(x=>x.status==='open'&&Boolean(x.due_on)&&x.due_on!<today).length,
   completed:tasks.filter(x=>x.status==='done').length};
}
