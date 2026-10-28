import {NextRequest,NextResponse} from "next/server";
import {createClient} from "../../../../../../lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** RLS-gated one-minute URL; never expose storage paths directly to the UI. */
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const noStore={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
 if(process.env.VERCEL_ENV!=="preview"||
  process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
  return new NextResponse(null,{status:404,headers:noStore});
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return new NextResponse(null,{status:401,headers:noStore});
 const {id}=await params;
 if(!uuid.test(id))return new NextResponse(null,{status:404,headers:noStore});
 const {data,error}=await db.from("mzs_ops_maintenance_photos").select("storage_path")
  .eq("id",id).maybeSingle();
 if(error||!data)return new NextResponse(null,{status:404,headers:noStore});
 const {data:signed,error:signError}=await db.storage.from("mzs-ops-ticket-photos")
  .createSignedUrl(data.storage_path,60,{download:true});
 if(signError||!signed?.signedUrl)return new NextResponse(null,{status:503,headers:noStore});
 return NextResponse.redirect(signed.signedUrl,{status:302,headers:noStore});
}
