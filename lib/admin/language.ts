import {cache} from 'react';
import {createClient} from '../supabase/server';
import {isPhase3aPreviewIsolated} from '../security/phase3a-preview-isolation';

/** Request-local presentation preference. Never grants access to a route or record. */
export const getAdminLanguage = cache(async ():Promise<'en'|'es'> => {
  if (!isPhase3aPreviewIsolated()) return 'en';
  try {
    const db=await createClient();
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user)return 'en';
    const {data,error}=await db.from('mzs_admin_language_preferences').select('language').eq('user_id',user.id).maybeSingle();
    return !error&&data?.language==='es'?'es':'en';
  }catch{return 'en';}
});
