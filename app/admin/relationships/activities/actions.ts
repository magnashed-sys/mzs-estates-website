'use server';

import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../lib/security/estate-properties';
import {crmNewActivity,crmUpdateTask,type CrmActionResult} from '../../../../lib/relationships/crm-activities';

const changed=()=>{revalidatePath('/admin/relationships/activities');revalidatePath('/admin/relationships/overview');};

export async function createCrmActivity(_state:CrmActionResult,form:FormData):Promise<CrmActionResult>{
 let payload:ReturnType<typeof crmNewActivity>;
 try{payload=crmNewActivity(form);}catch{return {status:'error',message:'Check the relationship, activity title, description and date.'};}
 const {db}=await requireEstateAdmin();
 const existing=await db.from('mzs_lease_relationships').select('id').eq('id',payload.relationship_id).maybeSingle();
 if(existing.error||!existing.data)return {status:'error',message:'The relationship could not be verified. No activity was saved.'};
 const {error}=await db.from('mzs_crm_activities').insert(payload);
 if(error)return {status:'error',message:'The activity could not be saved. Refresh and verify the current register.'};
 changed();
 return {status:'success',message:'Activity saved in the CRM record.'};
}

export async function updateCrmTask(_state:CrmActionResult,form:FormData):Promise<CrmActionResult>{
 let payload:ReturnType<typeof crmUpdateTask>;
 try{payload=crmUpdateTask(form);}catch{return {status:'error',message:'Check the task, revision and status.'};}
 const {db}=await requireEstateAdmin();
 const {data,error}=await db.from('mzs_crm_activities')
   .update({status:payload.status,due_on:payload.due_on,version:payload.revision+1})
   .eq('id',payload.id).eq('kind','task').eq('version',payload.revision)
   .select('id').maybeSingle();
 if(error||!data)return {status:'error',message:'This task may have changed. Refresh the register before updating.'};
 changed();
 return {status:'success',message:'Task updated and recorded in the audit trail.'};
}
