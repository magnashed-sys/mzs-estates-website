import { NextRequest, NextResponse } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
const reply = (status:number,data:Record<string,unknown>) =>
 NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function PATCH(request:NextRequest) {
 if(request.headers.get("origin")!==request.nextUrl.origin) return reply(403,{error:"Invalid origin"});
 const supabase=await createClient();
 const {data:auth}=await supabase.auth.getUser();
 if(!auth.user) return reply(401,{error:"Sign in required"});
 const {data:profile}=await supabase.from("profiles").select("role,is_active").eq("id",auth.user.id).single();
 if(profile?.role!=="admin"||profile.is_active!==true) return reply(403,{error:"Administrator required"});
 let input:{id?:unknown;status?:unknown};
 try{input=await request.json();}catch{return reply(400,{error:"Invalid request"});}
 if(typeof input.id!=="string"||!/^[0-9a-f-]{36}$/i.test(input.id)||
    !["new","in_review","contacted","closed"].includes(String(input.status)))
    return reply(400,{error:"Invalid status"});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return reply(503,{error:"Unavailable"});
 const admin=serviceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.from("mzs_capital_requests")
 .update({status:input.status,updated_at:new Date().toISOString()})
 .eq("id",input.id).select("id").single();
 if(error||!data)return reply(503,{error:"Unable to update request"});
 return reply(200,{updated:true});
}
