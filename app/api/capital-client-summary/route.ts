import {NextResponse} from 'next/server';
import {createClient} from '../../../lib/supabase/server';
import {capitalClientEnvironmentAllowed} from '../../../lib/security/capital-client-environment';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
export async function GET(){
 if(!capitalClientEnvironmentAllowed())return NextResponse.json({error:'Unavailable'},{status:404,headers});
 const db=await createClient();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401,headers});
 const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profileError||!profile?.is_active||!['client','partner'].includes(profile.role))return NextResponse.json({error:'Access restricted'},{status:403,headers});
 const result=await db.rpc('mzs_my_capital_summaries');
 if(result.error)return NextResponse.json({error:'Summary unavailable'},{status:503,headers});
 return NextResponse.json({items:result.data||[]},{headers});
}
