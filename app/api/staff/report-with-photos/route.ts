import {createHash,randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../../../lib/security/property-staff';
import {uuid} from '../../../../lib/property-operations/staff-work';
import {MAX_PHOTO_BYTES,normalizeMaintenancePhoto} from '../../../../lib/property-operations/maintenance-photo';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const bucket='mzs-ops-ticket-photos';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(status:number,message:string,extra:Record<string,unknown>={})=>
 NextResponse.json({ok:status<400,message,...extra},{status,headers});
const allowed=new Set(['image/jpeg','image/png','image/webp']);
const valid=(value:string,min:number,max:number)=>
 value.length>=min&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);

/** Create one scoped maintenance report and attach up to three sanitized photos.
 * Photos inherit the report's property and unit — no independent unit assignment.
 * Any partial upload failure keeps the report and returns the saved ticket ID.
 */
export async function POST(request:NextRequest){
 if(!staffEnvironmentAvailable())return respond(404,'Unavailable');
 const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 if(!origin||origin!==new URL(request.url).origin||
    (site&&site!=='same-origin'&&site!=='none'))return respond(403,'Invalid request origin');
 const size=Number(request.headers.get('content-length')??0);
 if(!Number.isFinite(size)||size>3*MAX_PHOTO_BYTES+600000)return respond(413,'Upload too large');
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return respond(401,'Sign in required');
 const [{data:profile,error:profileError},{data:properties,error:scopeError}]=await Promise.all([
  db.from('profiles').select('role,is_active').eq('id',user.id).maybeSingle(),
  db.from('mzs_ops_staff_property_directory').select('id'),
 ]);
 if(profileError||!profile?.is_active||!['client','partner'].includes(profile.role)||
    scopeError||!properties?.length)return respond(403,'Staff property access required');
 let form:FormData;
 try{form=await request.formData();}catch{return respond(400,'Invalid form');}
 const property_id=String(form.get('property_id')??'');
 const unit_id=String(form.get('unit_id')??'')||null;
 const title=String(form.get('title')??'').trim();
 const description=String(form.get('description')??'').trim();
 const priority=String(form.get('priority')??'');
 if(!uuid.test(property_id)||!properties.some(p=>p.id===property_id)||
    (unit_id&&!uuid.test(unit_id))||!['routine','soon','urgent'].includes(priority)||
    !valid(title,5,140)||!valid(description,8,3000))
  return respond(400,'Check the property, subject, urgency and description');
 if(unit_id){
  const {data:unit,error}=await db.from('mzs_ops_staff_unit_directory')
    .select('id,property_id').eq('id',unit_id).maybeSingle();
  if(error||!unit||unit.property_id!==property_id)return respond(400,'Unit does not belong to this property');
 }
 const photos=form.getAll('photos');
 if(photos.length>3)return respond(400,'A maximum of three photos is allowed');
 const processed:Buffer[]=[];
 try{
  for(const item of photos){
   if(!(item instanceof File)||!allowed.has(item.type)||item.size<1||item.size>MAX_PHOTO_BYTES)
    return respond(400,'Use a JPEG, PNG or WebP image up to 4 MB each');
   processed.push(await normalizeMaintenancePhoto(new Uint8Array(await item.arrayBuffer())));
  }
 }catch{return respond(400,'Photo could not be processed; use a still photo up to 20 megapixels');}
 const {data:ticket,error:ticketError}=await db.from('mzs_ops_maintenance_tickets')
  .insert({property_id,unit_id,priority,title,description}).select('id').single();
 if(ticketError||!ticket)return respond(409,'Maintenance report could not be saved');
 let uploaded=0;
 for(const bytes of processed){
  const path=ticket.id.toLowerCase()+'/'+randomUUID()+'.jpg';
  const stored=await db.storage.from(bucket).upload(path,bytes,{contentType:'image/jpeg',cacheControl:'0',upsert:false});
  if(stored.error)break;
  const {error:registrationError}=await db.from('mzs_ops_maintenance_photos').insert({
   ticket_id:ticket.id,storage_path:path,mime_type:'image/jpeg',
   sha256:createHash('sha256').update(bytes).digest('hex'),byte_size:bytes.length
  });
  if(registrationError){
   await db.storage.from(bucket).remove([path]);break;
  }
  uploaded+=1;
 }
 const partial=uploaded!==processed.length;
 return respond(partial?207:201,partial
  ? 'Maintenance report saved; some photos could not be added. Open the report to upload any missing photos.'
  : 'Maintenance report saved with '+uploaded+' photo(s).',
  {ticketId:ticket.id,photosUploaded:uploaded,photosSelected:processed.length,partial});
}
