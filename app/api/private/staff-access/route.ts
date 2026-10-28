import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../../../lib/security/property-staff';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow'};
export async function GET(){
 const reply=(available:boolean)=>NextResponse.json({available},{headers});
 if(!staffEnvironmentAvailable())return reply(false);
 const db=await createClient();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return reply(false);
 const {data,error:scopeError}=await db.from('mzs_ops_staff_property_directory').select('id').limit(1);
 return reply(!scopeError&&!!data?.length);
}
