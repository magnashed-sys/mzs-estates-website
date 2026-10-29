'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {uuid} from '../../../../../../lib/accountancy/archive';
import {linkTarget} from '../../../../../../lib/accountancy/document-links';
export async function saveDocumentLink(form:FormData):Promise<{ok:boolean}>{
 const {db}=await requireEstateAdmin();
 try{
  const target=linkTarget(String(form.get('kind')),String(form.get('target_id'))),document=String(form.get('document_id'));
  if(!uuid.test(document))return {ok:false};
  const {error}=await db.from('mzs_accountancy_document_links').insert({document_id:document,[target.column]:target.id});
  if(error){
   if(error.code!=='23505')return {ok:false};
   const prior=await db.from('mzs_accountancy_document_links').select('id').eq('document_id',document).eq(target.column,target.id).eq('is_active',true).maybeSingle();
   if(prior.error||!prior.data)return {ok:false};
  }
  revalidatePath('/admin','layout');return {ok:true};
 }catch{return {ok:false};}
}
export async function removeDocumentLink(form:FormData):Promise<{ok:boolean}>{
 const {db}=await requireEstateAdmin();
 try{
  const id=String(form.get('link_id')),reason=String(form.get('reason')??'').trim();
  if(!uuid.test(id)||reason.length<2||reason.length>500)return {ok:false};
  const {data,error}=await db.from('mzs_accountancy_document_links').update({is_active:false,removal_reason:reason}).eq('id',id).eq('is_active',true).select('id').maybeSingle();
  if(error||!data)return {ok:false};revalidatePath('/admin','layout');return {ok:true};
 }catch{return {ok:false};}
}
