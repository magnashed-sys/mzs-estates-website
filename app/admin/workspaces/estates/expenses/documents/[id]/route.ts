import {NextRequest,NextResponse} from "next/server";
import {requireEstateAdmin} from "../../../../../../../lib/security/estate-properties";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  .select("id,storage_path,sha256").eq("id",id).maybeSingle();
 if(error||!data)return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
 // No verified scanner is connected yet. The latest verdict must explicitly
 // be CLEAN and match the source SHA; absent/error/malicious = quarantine.
 const {data:latest,error:scanError}=await db.from("mzs_ops_expense_document_scan_events")
  .select("verdict,observed_sha256").eq("document_id",id)
  .order("id",{ascending:false}).limit(1).maybeSingle();
 if(scanError||!latest||latest.verdict!=="clean"||latest.observed_sha256!==data.sha256)
  return new NextResponse(null,{status:423,headers:{"Cache-Control":"no-store"}});
 const {data:signed,error:signError}=await db.storage.from("mzs-ops-expense-evidence")
  .createSignedUrl(data.storage_path,60,{download:true});
 if(signError||!signed?.signedUrl)
  return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});
 return NextResponse.redirect(signed.signedUrl,{
  status:302,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}
 });
}
