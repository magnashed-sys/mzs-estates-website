'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {HANDOVER_ROOT,handoverInput,type Result} from '../../../../../lib/accountancy/handover';
export async function saveHandover(_prior:Result,form:FormData):Promise<Result>{
 const {db}=await requireEstateAdmin();
 try{
  const v=handoverInput(form);
  const {error}=await db.rpc('mzs_save_accountant_handover',{p_year:v.year,p_id:v.id,p_kind:v.kind,p_revision:v.revision,p_data:v.data});
  if(error)return {status:'error',message:error.code==='40001'?'stale':error.code==='23514'?'requirements':'invalid'};
  revalidatePath(HANDOVER_ROOT);return {status:'success',message:'saved'};
 }catch{return {status:'error',message:'invalid'};}
}
