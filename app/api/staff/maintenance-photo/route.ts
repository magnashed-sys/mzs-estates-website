import {createHash,randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "../../../../lib/supabase/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const stage="https://senonkpxdtlhyhrubicg.supabase.co";
const bucket="mzs-ops-ticket-photos";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function fail(message:string,status:number){
 return NextResponse.json({ok:false,message},{status,headers:{"Cache-Control":"no-store"}});
}
function sameOrigin(req:NextRequest){
 const origin=req.headers.get("origin"),site=req.headers.get("sec-fetch-site");
 if(!origin||(site&&site!=="same-origin"&&site!=="none"))return false;
 try{return new URL(origin).origin===new URL(req.url).origin;}catch{return false;}
}
function detectImage(bytes:Uint8Array){
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:"image/jpeg",extension:"jpg"};
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))
  return {mime:"image/png",extension:"png"};
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF" &&
  String.fromCharCode(...bytes.slice(8,12))==="WEBP")return {mime:"image/webp",extension:"webp"};
 return null;
}
/** Uploaded source photos only; no public paths and no server-only service role. */
export async function POST(req:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.NEXT_PUBLIC_SUPABASE_URL!==stage)
  return fail("Alleen Staging",404);
 if(!sameOrigin(req))return fail("Ongeldige aanvraagbron",403);
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return fail("Aanmelden vereist",401);
 let data:FormData;
 try{data=await req.formData();}catch{return fail("Ongeldig uploadformulier",400);}
 const ticketId=data.get("ticket_id"),file=data.get("file");
 if(typeof ticketId!=="string"||!uuid.test(ticketId)||
  !(file instanceof File)||file.size<1||file.size>4194304)
  return fail("Selecteer een melding en foto van maximaal 4 MB",400);
 const [ticket,existing,profile]=await Promise.all([
  db.from("mzs_ops_maintenance_tickets").select("id,reported_by,property_id")
    .eq("id",ticketId).maybeSingle(),
  db.from("mzs_ops_maintenance_photos").select("id",{count:"exact",head:true}).eq("ticket_id",ticketId),
  db.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle()
 ]);
 if(ticket.error||!ticket.data||existing.error||existing.count===null||
  existing.count>=3||profile.error||!profile.data||profile.data.is_active!==true)
  return fail("Geen toegang tot deze melding of maximaal drie foto's bereikt",403);
 const isAdmin=profile.data.role==="admin";
 if(!isAdmin&&ticket.data.reported_by!==user.id)
  return fail("Alleen eigen onderhoudsmeldingen",403);
 let bytes:Uint8Array;
 try{bytes=new Uint8Array(await file.arrayBuffer());}catch{return fail("Kan foto niet lezen",400);}
 if(bytes.length!==file.size)return fail("Bestandsgrootte klopt niet",400);
 const type=detectImage(bytes);
 if(!type)return fail("Alleen JPEG, PNG of WebP foto's",400);
 const path=ticketId.toLowerCase()+"/"+randomUUID()+"."+type.extension;
 const digest=createHash("sha256").update(bytes).digest("hex");
 const upload=await db.storage.from(bucket).upload(path,bytes,{contentType:type.mime,cacheControl:"0",upsert:false});
 if(upload.error)return fail("Foto kon niet veilig worden opgeslagen",403);
 const meta=await db.from("mzs_ops_maintenance_photos").insert({
  ticket_id:ticketId,storage_path:path,mime_type:type.mime,sha256:digest,byte_size:bytes.length
 });
 if(meta.error){
  await db.storage.from(bucket).remove([path]);
  return fail("Fotoregistratie geweigerd; controleer de melding",409);
 }
 return NextResponse.json({ok:true,message:"Onderhoudsfoto beveiligd gekoppeld aan de melding"},{status:201,headers:{"Cache-Control":"no-store"}});
}
