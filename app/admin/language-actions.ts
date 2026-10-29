'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../lib/security/phase3a-preview-isolation';

/** A presentation preference only; permissions remain with each existing route/action. */
export async function saveAdminLanguage(language:string):Promise<{ok:boolean}>{
  if(!['en','es'].includes(language)||!isPhase3aPreviewIsolated())return {ok:false};
  const db=await createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)return {ok:false};
  const {data:profile,error:profileError}=await db.from('profiles').select('is_active').eq('id',user.id).maybeSingle();
  if(profileError||profile?.is_active!==true)return {ok:false};
  const {error}=await db.from('mzs_admin_language_preferences').upsert({user_id:user.id,language});
  if(error)return {ok:false};
  revalidatePath('/admin','layout');
  return {ok:true};
}
