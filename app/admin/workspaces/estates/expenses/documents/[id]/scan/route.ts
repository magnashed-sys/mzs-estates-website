import {createHash,randomUUID} from "node:crypto";
import {createClient as createSupabaseClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";
import {requireEstateAdmin} from "../../../../../../../../lib/security/estate-properties";
import {scanStagingPdfWithCloudmersive,scannerIsExplicitlyEnabled} from
 "../../../../../../../../lib/property-operations/scanner/cloudmersive-advanced";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const STAGING="https://senonkpxdtlhyhrubicg.supabase.co";
const BUCKET="mzs-ops-expense-evidence";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow"};
const failure=(status:number,reason:string)=>NextResponse.json({ok:false,message:reason},{status,headers});
function validOrigin(request:NextRequest){
 const origin=request.headers.get("origin");
 const site=request.headers.get("sec-fetch-site");
 if(!origin||(site&&site!=="same-origin"))return false;
 try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

/** Preview-only scan dispatch. NO scheduled job and NO unapproved vendor transfer.
 *
 * Only a human active Group Admin may initiate a scan. Supabase service-role
 * access is used strictly after this authorization to read quarantined bytes,
 * validate their exact SHA and append a scanner verdict (no finance mutation).
 *
 * A new verified provider requires a separate consent/setup release.
 */
export async function POST(
 request:NextRequest,{params}:{params:Promise<{id:string}>}
){
 const options={
  environment:process.env.VERCEL_ENV,
  supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
  enabled:process.env.MZS_OPS_AV_SCAN_ENABLED,
  processorApproved:process.env.MZS_OPS_AV_PROCESSOR_APPROVED,
  apiKey:process.env.MZS_OPS_CLOUDMERSIVE_API_KEY
 };
 const key=process.env.MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY;
 if(!scannerIsExplicitlyEnabled(options)||!key||key.length<40)
  return failure(503,"De scanner is nog niet aangesloten of niet vrijgegeven. Document blijft in quarantaine.");
 if(!validOrigin(request))return failure(403,"Ongeldige aanvraagbron.");
 const {id}=await params;
 if(!uuid.test(id))return failure(400,"Ongeldige documentreferentie.");
 const {db}=await requireEstateAdmin();
 const {data:original,error:readError}=await db.from("mzs_ops_expense_documents")
  .select("id,draft_id,storage_path,sha256,file_size,mime_type").eq("id",id).maybeSingle();
 if(readError||!original)return failure(404,"Document niet gevonden.");
 // The browser may not supply Storage paths, the target legal entity or a scan verdict.
 if(original.mime_type!=="application/pdf"||original.file_size<128||
  original.file_size>4_194_304||
  !original.storage_path.startsWith(original.draft_id+"/")||
  !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(original.storage_path))
  return failure(409,"Documentmetadata is niet geschikt voor verificatie.");
 const {data:previous,error:previousError}=await db.from("mzs_ops_expense_document_scan_events")
  .select("id,verdict").eq("document_id",id)
  .order("id",{ascending:false}).limit(1).maybeSingle();
 if(previousError)return failure(503,"De huidige scanstatus kon niet worden gecontroleerd.");
 if(previous&&previous.verdict!=="unscannable")
  return failure(409,"Dit document heeft al een definitieve scanuitslag. Controleer de beveiligingshistorie.");
 // Restrict privileged access to exact Staging even if configuration is erroneous.
 const service=createSupabaseClient(STAGING,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 const {data:stored,error:downloadError}=await service.storage.from(BUCKET)
  .download(original.storage_path);
 if(downloadError||!stored)
  return failure(503,"Document kan niet veilig uit quarantaine worden gelezen.");
 let bytes:Uint8Array;
 try{bytes=new Uint8Array(await stored.arrayBuffer());}
 catch{return failure(503,"Document kan niet worden gevalideerd.");}
 const actual=createHash("sha256").update(bytes).digest("hex");
 if(bytes.length!==original.file_size||actual!==original.sha256)
  return failure(409,"Document komt niet overeen met de onveranderbare SHA-256; geen scan verzonden.");

 // Never return scanner output, API key or document contents to the browser.
 const scan=await scanStagingPdfWithCloudmersive(bytes,options);
 const {error:insertError}=await service.from("mzs_ops_expense_document_scan_events").insert({
  document_id:original.id,observed_sha256:actual,verdict:scan.verdict,
  scanner_engine:scan.engine,scanner_version:scan.version,
  scan_reference:"mzs-av-"+randomUUID()
 });
 if(insertError)return failure(503,"Scannerresultaat kon niet betrouwbaar worden vastgelegd; quarantaine blijft actief.");
 return NextResponse.json({
  ok:true,verdict:scan.verdict,
  message:scan.verdict==="clean"?
   "De externe scanner meldt dit testdocument als schoon. Beoordeling kan afzonderlijk plaatsvinden.":
   "Het document blijft geblokkeerd: geen positieve scanuitslag."
 },{headers});
}
