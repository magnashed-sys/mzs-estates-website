'use server';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffTaskEnvironment,taskUuid} from '../../../../../../lib/property-operations/property-tasks';
import {taskInput,taskUpdateInput,field,optionalUuid,dateInput} from '../../../../../../lib/property-operations/task-input';
import {revalidateOperations} from '../../../../../../lib/property-operations/revalidate';
import {revalidatePath} from 'next/cache';
type Result={status:'idle'|'error'|'success';message:string};
const wrong=(message='Check task details, property, unit, assignee and permissions.'):Result=>({status:'error',message});
const refresh=()=>{revalidateOperations();revalidatePath('/admin/workspaces/estates/staff/tasks');};
export async function createPropertyTask(_prior:Result,form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();
 const {db}=await requireEstateAdmin();
 try{
  const payload=taskInput(form);
  const {error}=await db.from('mzs_ops_property_tasks').insert(payload);
  if(error)return wrong('Task was not created. Confirm the assigned account has access to the property and the selected unit belongs to it.');
  refresh();return {status:'success',message:'Task created. The assignee can see it on the property manager dashboard.'};
 }catch{return wrong();}
}
export async function updatePropertyTask(_prior:Result,form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();
 const {db}=await requireEstateAdmin();
 try{
  const id=field(form,'task_id',36);if(!taskUuid.test(id))throw Error('Invalid ID');
  const payload=taskInput(form);
  const {data:original,error:look}=await db.from('mzs_ops_property_tasks').select('property_id').eq('id',id).single();
  if(look||!original||original.property_id!==payload.property_id)return wrong('Task not found or property cannot be changed.');
  const {error}=await db.from('mzs_ops_property_tasks').update({
   unit_id:payload.unit_id,assigned_profile_id:payload.assigned_profile_id,
   title:payload.title,description:payload.description,priority:payload.priority,
   due_on:payload.due_on,source_reference:payload.source_reference
  }).eq('id',id);
  if(error)return wrong('Task update denied. Check employee scope and matching unit.');
  refresh();return {status:'success',message:'Task updated with a permanent admin audit record.'};
 }catch{return wrong();}
}
export async function updateTaskProgressAdmin(_prior:Result,form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();
 const {db}=await requireEstateAdmin();
 try{
  const payload=taskUpdateInput(form);
  const {error}=await db.from('mzs_ops_property_task_updates').insert(payload);
  if(error)return wrong('Task status could not be updated. Refresh and check its current state.');
  refresh();return {status:'success',message:'Progress saved with full history.'};
 }catch{return wrong();}
}
