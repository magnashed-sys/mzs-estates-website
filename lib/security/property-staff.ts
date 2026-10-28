import {notFound,redirect} from 'next/navigation';
import {createClient} from '../supabase/server';

export function staffEnvironmentAvailable(){
 return (process.env.VERCEL_ENV==='production'&&process.env.NEXT_PUBLIC_SUPABASE_URL==='https://ptrnjzmcehrhbsfxntgw.supabase.co')||
 (process.env.VERCEL_ENV==='preview'&&process.env.NEXT_PUBLIC_SUPABASE_URL==='https://senonkpxdtlhyhrubicg.supabase.co');
}
export function requireStaffEnvironment(){if(!staffEnvironmentAvailable())notFound();}
export async function requirePropertyStaff(){
 requireStaffEnvironment();
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)redirect('/login');
 const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profileError||!profile?.is_active||!['client','partner'].includes(profile.role))notFound();
 const {data:properties,error:scopeError,count}=await db.from('mzs_ops_staff_property_directory').select('id,name,address',{count:'exact'}).order('name').limit(1000);
 if(scopeError||count!==properties?.length)throw Error('Objecttoegang kon niet volledig worden geladen. Probeer opnieuw.');
 if(!properties?.length)notFound();
 return {db,user,properties};
}
