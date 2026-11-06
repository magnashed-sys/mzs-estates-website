import {createClient} from '../supabase/server';
import {contractsAvailable} from './estate-contracts';

/** API guards return status responses instead of throwing page redirects. */
export async function requireContractAdminApi():Promise<{response:Response}|{db:Awaited<ReturnType<typeof createClient>>}>{
 const deny=(status:number,error:string)=>({response:Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}})});
 if(!contractsAvailable())return deny(404,'Not found.');
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return deny(401,'Authentication required.');
 const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profileError)return deny(503,'Unable to verify administrator access.');
 if(profile?.role!=='admin'||profile.is_active!==true)return deny(403,'Administrator access required.');
 return {db};
}
