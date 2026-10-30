'use server';
import {notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffTaskEnvironment} from '../../../../../../lib/property-operations/property-tasks';
import {recurringInput} from '../../../../../../lib/property-operations/recurring-tasks';
import {revalidateOperations} from '../../../../../../lib/property-operations/revalidate';
export type Result={status:'idle'|'error'|'success';message:string};
const refresh=()=>{revalidatePath('/admin/workspaces/estates/staff/recurring');revalidatePath('/admin/workspaces/estates/staff/tasks');revalidateOperations();};
export async function saveRecurringPlan(_prior:Result,form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();const {db}=await requireEstateAdmin();
 try{
  const value=recurringInput(form);
  const {error}=await db.rpc('mzs_save_recurring_plan',{p_id:value.id,p_revision:value.revision,p_data:value.data});
  if(error)return {status:'error',message:error.code==='40001'?'stale':'invalid'};
  refresh();return {status:'success',message:'saved'};
 }catch{return {status:'error',message:'invalid'};}
}
export async function generateRecurringTasks(_prior:Result,_form:FormData):Promise<Result>{
 if(!staffTaskEnvironment())notFound();const {db}=await requireEstateAdmin();
 const {data,error}=await db.rpc('mzs_generate_recurring_tasks');
 if(error||!data)return {status:'error',message:'generation_failed'};
 refresh();return {status:data.errors?'error':'success',message:JSON.stringify({created:data.created,errors:data.errors})};
}
