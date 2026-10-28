import {NextRequest,NextResponse} from "next/server";
import {requireEstateAdmin} from "../../../../../../../lib/security/estate-properties";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Create a one-minute, private, download-only URL. Never expose Storage paths. */
export async function GET(
 _request:NextRequest,{params}:{params:Promise<{id:string}>}
){
 if(process.env.VERCEL_ENV!=="preview"||
    process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
  return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
 const {db}=await requireEstateAdmin();
 const {id}=await params;
 if(!uuid.test(id))return new NextResponse(null,{status:404});
 const {data,error}=await db.from("mzs_ops_expense_documents")
  .select("storage_path").eq("id",id).maybeSingle();
 if(error||!data)return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
 const {data:signed,error:signError}=await db.storage.from("mzs-ops-expense-evidence")
  .createSignedUrl(data.storage_path,60,{download:true});
 if(signError||!signed?.signedUrl)
  return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});
 return NextResponse.redirect(signed.signedUrl,302,{
  headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}
 });
}
