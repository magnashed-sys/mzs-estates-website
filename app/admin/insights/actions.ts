'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
import {insightInput} from '../../../lib/insights/model';
export type SaveState={status:'idle'|'success'|'error';message:string;id?:string;revision?:number};
export async function saveInsight(_:SaveState,form:FormData):Promise<SaveState>{
 const {db}=await requireEstateAdmin();
 let input:ReturnType<typeof insightInput>;
 try{input=insightInput(form);}catch(error){return {status:'error',message:error instanceof Error?error.message:'Check the article fields.'};}
 const {id,revision,data}=input;
 const result=revision===0
  ?await db.from('mzs_insights').insert({id,...data}).select('id,revision').single()
  :await db.from('mzs_insights').update(data).eq('id',id).eq('revision',revision).select('id,revision').maybeSingle();
 if(result.error){
  const message=result.error.code==='23505'?'This language version or URL already exists. Open the existing version or choose a different URL.'
   :result.error.message.includes('URL is locked')?'This URL is locked because publication has already been enabled.'
   :'Saving failed. Your changes remain in the editor. Please try again.';
  return {status:'error',message};
 }
 if(!result.data) return {status:'error',message:'Someone changed this article. Copy your edits, reload the page and review the latest version before saving.'};
 revalidatePath('/admin/insights');revalidatePath('/admin/insights/'+id);
 return {status:'success',message:'Saved.',id,revision:result.data.revision};
}
