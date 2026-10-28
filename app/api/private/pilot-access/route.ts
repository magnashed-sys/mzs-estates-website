import {NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";
import {resolvePilotEnvironment} from "../../../../lib/property-operations/pilot-environment";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex, nofollow"};
const unavailable=()=>NextResponse.json({available:false},{headers});

/**
 * Dashboard navigation hint only, not an access token.
 * The /pilot/staff page and every mutation recheck authentication, scoped RLS
 * and the exact deployment flag. Never return other users' property data.
 */
export async function GET(){
 const environment=resolvePilotEnvironment({
  VERCEL_ENV:process.env.VERCEL_ENV,
  NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,
  VERCEL_GIT_COMMIT_SHA:process.env.VERCEL_GIT_COMMIT_SHA,
  MZS_OPS_STAGING_PILOT_ENABLED:process.env.MZS_OPS_STAGING_PILOT_ENABLED,
  MZS_OPS_PRODUCTION_PILOT_ENABLED:process.env.MZS_OPS_PRODUCTION_PILOT_ENABLED,
  MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA:process.env.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA
 });
 if(!environment)return unavailable();
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return unavailable();
 const {data:profile,error:profileError}=await db.from("profiles")
  .select("role,is_active").eq("id",user.id).maybeSingle();
 if(profileError||profile?.is_active!==true||
    !["client","partner"].includes(String(profile.role)))return unavailable();
 const {data,error,count}=await db.from("mzs_ops_pilot_my_properties")
  .select("property_name",{count:"exact"}).limit(2);
 if(error||!data||count!==1||data.length!==1||typeof data[0].property_name!=="string")
  return unavailable();
 return NextResponse.json({available:true,propertyName:data[0].property_name},{headers});
}
