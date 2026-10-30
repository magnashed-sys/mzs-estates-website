'use server';
import {notFound} from 'next/navigation';
import {after} from 'next/server';
import {deliverPropertyStaffTaskNotice} from '../../lib/mzs/notifications';
import {requirePropertyStaff} from '../../lib/security/property-staff';
import {staffTaskEnvironment} from '../../lib/property-operations/property-tasks';
import {taskInput,taskUpdateInput} from '../../lib/property-operations/task-input';
import {revalidateOperations} from '../../lib/property-operations/revalidate';
import {revalidatePath} from 'next/cache';
type Result={status:'idle'|'error'|'success';message:string};
function refresh(){revalidateOperations();revalidatePath('/admin/workspaces/estates/staff/tasks');}
export async function createMyPropertyTask(_prior:Result,form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();
 const {db,user,properties}=await requirePropertyStaff();
 try{
  const payload=taskInput(form);
  let allowed=payload.property_id!==null&&properties.some(p=>p.id===payload.property_id);
  if(payload.work_area_id){
   const {data,error}=await db.from('mzs_ops_staff_work_area_directory')
    .select('id').eq('id',payload.work_area_id).maybeSingle();
   allowed=!error&&!!data;
  }
  if(!allowed||payload.assigned_profile_id!==user.id)
   return {status:'error',message:'Only your assigned work locations and own account can be used.'};
  const {data:created,error}=await db.from('mzs_ops_property_tasks')
    .insert(payload).select('id').single();
  if(error||!created)return {status:'error',message:'Task could not be created. Check the unit and access rights.'};
  // Database trigger queues one idempotent notification. Delivery happens
  // after the response so a slow SMTP provider cannot block task creation;
  // the existing mail cron handles retries.
  after(async()=>{await deliverPropertyStaffTaskNotice(created.id);});
  refresh();return {status:'success',message:'Task created. It is also visible to the administrator.'};
 }catch{return {status:'error',message:'Check the title, property, dates and priority.'};}
}
export async function updateMyTaskProgress(_prior:Result,form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();
 const {db,user,properties}=await requirePropertyStaff();
 try{
  const payload=taskUpdateInput(form);
  if(!['in_progress','blocked','done'].includes(payload.status))return {status:'error',message:'Select a valid task status.'};
  const {data:task,error:readError}=await db.from('mzs_ops_property_tasks')
   .select('id,property_id,work_area_id,assigned_profile_id').eq('id',payload.task_id).maybeSingle();
  if(readError||!task||task.assigned_profile_id!==user.id)
   return {status:'error',message:'Task access not available.'};
  if(task.work_area_id){
   const {data:area,error:areaError}=await db.from('mzs_ops_staff_work_area_directory')
    .select('id').eq('id',task.work_area_id).maybeSingle();
   if(areaError||!area)return {status:'error',message:'Work area access not available.'};
  }else if(!properties.some(p=>p.id===task.property_id))
   return {status:'error',message:'Property access not available.'};
  const {error}=await db.from('mzs_ops_property_task_updates').insert(payload);
  if(error)return {status:'error',message:'Progress not saved; refresh to view the latest status.'};
  refresh();return {status:'success',message:'Your task update was saved.'};
 }catch{return {status:'error',message:'Check task status and a short progress note.'};}
}
