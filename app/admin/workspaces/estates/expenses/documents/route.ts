import {createHash, randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {requireEstateAdmin} from "../../../../../../lib/security/estate-properties";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const bucket="mzs-ops-expense-evidence";
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fileType(bytes:Uint8Array):{mime:string;ext:string}|null{
 if(bytes.length>=5 && bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70&&bytes[4]===45)
  return {mime:"application/pdf",ext:"pdf"};
 if(bytes.length>=3 && bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
  return {mime:"image/jpeg",ext:"jpg"};
 if(bytes.length>=8 && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))
  return {mime:"image/png",ext:"png"};
 return null;
}
function fail(message:string,status:number){
 return NextResponse.json({ok:false,message},{status,headers:{"Cache-Control":"no-store"}});
}
function originIsValid(request:NextRequest):boolean{
 const origin=request.headers.get("origin");
 const site=request.headers.get("sec-fetch-site");
 if(!origin || (site && !["same-origin","none"].includes(site)))return false;
 try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}

/** Admin-only Staging. Upload is immutable and never issues invoices or email. */
export async function POST(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview" || process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)
  return fail("Documenten zijn alleen op de geïsoleerde Staging Preview beschikbaar.",404);
 if(!originIsValid(request))return fail("Ongeldige aanvraagbron.",403);
 const {db}=await requireEstateAdmin();
 let data:FormData;
 try{data=await request.formData();}catch{return fail("Geen geldig uploadformulier.",400);}
 const draftId=data.get("draft_id");
 const source=data.get("file");
 if(typeof draftId!=="string"||!uuid.test(draftId)||
    !(source instanceof File)||source.size<1||source.size>4194304)
  return fail("Selecteer een geldig kostenconcept en een bestand tot 4 MB.",400);
 const [{data:draft,error:draftError},{data:existing,error:existingError},
        {data:reviews,error:reviewError}]=await Promise.all([
    db.from("mzs_ops_expense_drafts").select("id").eq("id",draftId).maybeSingle(),
    db.from("mzs_ops_expense_documents").select("id").eq("draft_id",draftId).maybeSingle(),
    db.from("mzs_ops_expense_review_events").select("id").eq("draft_id",draftId).limit(1),
 ]);
 if(draftError||!draft||existingError||existing||reviewError||!reviews)
  return fail("Kostenconcept ontbreekt, heeft al bewijs of is niet volledig beschikbaar.",409);
 if(reviews.length>0)return fail("Na indiening kan het originele document niet meer worden vervangen.",409);
 let bytes:Uint8Array;
 try{bytes=new Uint8Array(await source.arrayBuffer());}
 catch{return fail("Bestand kon niet worden gelezen.",400);}
 if(bytes.length!==source.size)return fail("Bestandsgrootte komt niet overeen.",400);
 const detected=fileType(bytes);
 if(!detected)return fail("Alleen geldige PDF-, JPEG- of PNG-bestanden zijn toegestaan.",400);
 const path=draftId.toLowerCase()+"/"+randomUUID()+"."+detected.ext;
 const sha256=createHash("sha256").update(bytes).digest("hex");
 const {error:uploadError}=await db.storage.from(bucket).upload(path,bytes,{
   contentType:detected.mime,cacheControl:"0",upsert:false
 });
 if(uploadError)return fail("Upload niet gelukt; document is niet geregistreerd.",400);
 const {error:metaError}=await db.from("mzs_ops_expense_documents").insert({
  draft_id:draftId,storage_path:path,sha256,mime_type:detected.mime,file_size:bytes.length
 });
 if(metaError){
   // Best effort clean-up: Storage policy allows deletion only if NO metadata references the path.
   await db.storage.from(bucket).remove([path]);
   return fail("Documentregistratie is mislukt. Controleer het concept voordat je opnieuw probeert.",409);
 }
 return NextResponse.json({ok:true,message:"Origineel document veilig gekoppeld aan het kostenconcept."},{
  status:201,headers:{"Cache-Control":"no-store"}
 });
}
