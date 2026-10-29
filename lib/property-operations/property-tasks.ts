/** A staged, scoped, non-financial property manager workflow. */
export const taskUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const taskPriorities=['low','normal','high','urgent'] as const;
export const taskStatuses=['open','in_progress','blocked','done','cancelled'] as const;
export type TaskPriority=(typeof taskPriorities)[number];
export type TaskStatus=(typeof taskStatuses)[number];
export type PropertyTask={
 id:string;property_id:string|null;work_area_id:string|null;unit_id:string|null;assigned_profile_id:string|null;
 title:string;description:string;priority:TaskPriority;due_on:string|null;source_reference:string;
 created_by:string;created_at:string;status:TaskStatus;latest_note:string|null;status_updated_at:string|null;
};
export const taskStatusName:Record<TaskStatus,string>={
 open:'Open',in_progress:'In progress',blocked:'Waiting / blocked',done:'Completed',cancelled:'Cancelled'
};
export const taskPriorityName:Record<TaskPriority,string>={
 low:'Low',normal:'Normal',high:'High',urgent:'Urgent'
};
export function staffTaskEnvironment(env:NodeJS.ProcessEnv=process.env){
 return (env.VERCEL_ENV==='preview'&&env.NEXT_PUBLIC_SUPABASE_URL==='https://senonkpxdtlhyhrubicg.supabase.co'&&env.MZS_STAFF_TASKS_ENABLED==='true')||
 (env.VERCEL_ENV==='production'&&env.NEXT_PUBLIC_SUPABASE_URL==='https://ptrnjzmcehrhbsfxntgw.supabase.co'&&env.MZS_STAFF_TASKS_REAL_ENABLED==='true');
}
export function validateTaskPlacement(task:Pick<PropertyTask,'property_id'|'unit_id'>,work:{property_id:string;unit_id:string|null}){
 return task.property_id===work.property_id&&(!task.unit_id||task.unit_id===work.unit_id);
}
export function taskOverview(tasks:readonly PropertyTask[],today:string){
 const visible=tasks.filter(t=>t.status!=='cancelled');
 const open=visible.filter(t=>t.status!=='done');
 const todayWork=open.filter(t=>!t.due_on||t.due_on<=today);
 const urgent=open.filter(t=>t.priority==='urgent'||t.priority==='high');
 const late=open.filter(t=>t.due_on&&t.due_on<today);
 return {open:open.length,today:todayWork.length,urgent:urgent.length,late:late.length,
  completed:visible.length-open.length};
}
export function taskOrder(tasks:readonly PropertyTask[]):PropertyTask[]{
 const sortPriority=(x:TaskPriority)=>taskPriorities.indexOf(x);
 return [...tasks].sort((a,b)=>{
  const aa=a.status==='done'||a.status==='cancelled',bb=b.status==='done'||b.status==='cancelled';
  return Number(aa)-Number(bb)||
   Number(a.status==='blocked')-Number(b.status==='blocked')||
   sortPriority(b.priority)-sortPriority(a.priority)||
   (a.due_on||'9999-12-31').localeCompare(b.due_on||'9999-12-31')||
   a.created_at.localeCompare(b.created_at)||
   a.id.localeCompare(b.id);
 });
}
