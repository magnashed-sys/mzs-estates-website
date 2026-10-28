import {notFound,redirect} from "next/navigation";
import {createClient} from "../supabase/server";
import {resolvePilotEnvironment} from "../property-operations/pilot-environment";

/** A server-side flag never replaces verified Supabase identity or RLS. */
async function requirePilotIdentity(){
 if(resolvePilotEnvironment(process.env)===null)notFound();
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)redirect("/login");
 const {data:profile,error:profileError}=await db.from("profiles")
  .select("id,role,is_active").eq("id",user.id).maybeSingle();
 if(profileError||!profile||profile.is_active!==true)notFound();
 return {db,user,role:String(profile.role)};
}
export async function requireOpsPilotAdmin(){
 const actor=await requirePilotIdentity();
 if(actor.role!=="admin")notFound();
 return actor;
}
export async function requireOpsPilotStaff(){
 const actor=await requirePilotIdentity();
 if(!["client","partner"].includes(actor.role))notFound();
 // A current live grant and active run are checked by a database SECURITY INVOKER view.
 const {data,error,count}=await actor.db.from("mzs_ops_pilot_my_properties")
  .select("run_id,property_id,property_name,property_address",{count:"exact"})
  .order("property_name").limit(10);
 if(error||!data||count===null||count!==data.length||data.length!==1)notFound();
 return {...actor,assignment:data[0]};
}
