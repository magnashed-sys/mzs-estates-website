import {createHash,randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../../../lib/security/property-staff';
import {uuid} from '../../../../lib/property-operations/staff-work';
import {normalizeMaintenancePhoto,MAX_PHOTO_BYTES} from '../../../../lib/property-operations/maintenance-photo';
export const runtime='nodejs';export const dynamic='force-dynamic';
const bucket='mzs-ops-ticket-photos';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=(message:string,status:number)=>NextResponse.json({ok:false,message},{status,headers});
export async function POST(req:NextRequest){
 if(!staffEnvironmentAvailable())return fail('Niet beschikbaar',404);
 const origin=req.headers.get('origin'),site=req.headers.get('sec-fetch-site');
 if(!origin||origin!==new URL(req.url).origin||(site&&site!=='same-origin'&&site!=='none'))return fail('Ongeldige aanvraagbron',403);
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return fail('Aanmelden vereist',401);
 const size=Number(req.headers.get('content-length')??0);if(size>MAX_PHOTO_BYTES+100000)return fail('Foto is te groot',413);
 let form:FormData;try{form=await req.formData();}catch{return fail('Ongeldig uploadformulier',400);}
 const ticketId=String(form.get('ticket_id')??''),file=form.get('file');
 if(!uuid.test(ticketId)||!(file instanceof File)||file.size<1||file.size>MAX_PHOTO_BYTES)return fail('Kies een foto van maximaal 4 MB',400);
 const [ticket,existing,profile]=await Promise.all([
 db.from('mzs_ops_maintenance_tickets').select('id,reported_by').eq('id',ticketId).maybeSingle(),
 db.from('mzs_ops_maintenance_photos').select('id',{count:'exact',head:true}).eq('ticket_id',ticketId),
 db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle()]);
 if(ticket.error||!ticket.data||existing.error||existing.count===null||existing.count>=3||profile.error||!profile.data?.is_active||(profile.data.role!=='admin'&&ticket.data.reported_by!==user.id))return fail('Geen toegang of maximaal drie foto’s bereikt',403);
 let bytes:Buffer;try{bytes=await normalizeMaintenancePhoto(new Uint8Array(await file.arrayBuffer()));}catch{return fail('Foto kon niet worden verwerkt. Gebruik een stilstaande JPEG, PNG of WebP van maximaal 20 megapixels.',400);}
 const path=ticketId.toLowerCase()+'/'+randomUUID()+'.jpg';
 const upload=await db.storage.from(bucket).upload(path,bytes,{contentType:'image/jpeg',cacheControl:'0',upsert:false});
 if(upload.error)return fail('Foto kon niet worden opgeslagen',503);
 const {error}=await db.from('mzs_ops_maintenance_photos').insert({ticket_id:ticketId,storage_path:path,mime_type:'image/jpeg',sha256:createHash('sha256').update(bytes).digest('hex'),byte_size:bytes.length});
 if(error){await db.storage.from(bucket).remove([path]);return fail('Fotoregistratie geweigerd. Controleer of de melding inmiddels is veranderd.',409);}
 return NextResponse.json({ok:true,message:'Foto toegevoegd. Locatie- en camerametadata zijn verwijderd.'},{status:201,headers});
}
