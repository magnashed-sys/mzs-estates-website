import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../../../lib/security/phase3a-preview-isolation';
export const dynamic='force-dynamic';
export async function GET(){
 const reply=(available:boolean)=>NextResponse.json({available},{headers:{'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow'}});
 if(!isPhase3aPreviewIsolated())return reply(false);
 try{const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)return reply(false);
 const {data,error:scopeError}=await db.rpc('mzs_partner_entities');return reply(!scopeError&&Array.isArray(data)&&data.length>0);
 }catch{return reply(false);}
}
