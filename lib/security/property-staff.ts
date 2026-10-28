import {notFound,redirect} from "next/navigation";
import {createClient} from "../supabase/server";
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
/** Staff access is independent of the existing client/partner role. */
export async function requirePropertyStaff(){
 if(process.env.VERCEL_ENV!=="preview" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)notFound();
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)redirect("/login");
 const {data:profile,error:profileError}=await db.from("profiles")
  .select("id,role,is_active").eq("id",user.id).single();
 if(profileError||!profile||profile.is_active!==true||
    !["client","partner"].includes(profile.role))notFound();
 const {data:properties,error:scopeError,count}=await db.from("mzs_ops_staff_property_directory")
  .select("id,name,address",{count:"exact"}).order("name").limit(200);
 if(scopeError||!properties||count===null||count!==properties.length)notFound();
 if(properties.length===0)notFound();
 return {db,user,properties};
}
