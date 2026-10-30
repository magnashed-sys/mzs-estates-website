import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../../../lib/security/property-staff';
import {uuid} from '../../../../lib/property-operations/staff-work';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(status:number,message:string,extra:Record<string,unknown>={})=>
 NextResponse.json({ok:status<400,message,...extra},{status,headers});
const valid=(value:string,min:number,max:number)=>
 value.length>=min&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);

/** First phase of a multi-photo maintenance report: create one scoped report.
 * Each optional image is submitted separately to the already reviewed private
 * /api/staff/maintenance-photo endpoint, avoiding Vercel's request size limit.
 */
export async function POST(request:NextRequest){
 if(!staffEnvironmentAvailable())return respond(404,'Unavailable');
 const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 if(!origin||origin!==new URL(request.url).origin||
    (site&&site!=='same-origin'&&site!=='none'))return respond(403,'Invalid request origin');
 const size=Number(request.headers.get('content-length')??0);
 if(!Number.isFinite(size)||size>32000)return respond(413,'Report form too large');
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
 if(form.has('photos'))return respond(400,'Upload photos separately after the report is created');
 const property_id=String(form.get('property_id')??'');
 const unit_id=String(form.get('unit_id')??'')||null;
 const title=String(form.get('title')??'').trim();
 const description=String(form.get('description')??'').trim();
 const priority=String(form.get('priority')??'');
 if(!uuid.test(property_id)||!properties.some(p=>p.id===property_id)||
    (unit_id&&!uuid.test(unit_id))||!['routine','soon','urgent'].includes(priority)||
    !valid(title,5,140)||!valid(description,8,3000))
  return respond(400,'Check property, subject, urgency and description');
 if(unit_id){
  const {data:unit,error}=await db.from('mzs_ops_staff_unit_directory')
    .select('id,property_id').eq('id',unit_id).maybeSingle();
  if(error||!unit||unit.property_id!==property_id)return respond(400,'Unit does not belong to this property');
 }
 const {data:ticket,error:ticketError}=await db.from('mzs_ops_maintenance_tickets')
  .insert({property_id,unit_id,priority,title,description}).select('id').single();
 if(ticketError||!ticket)return respond(409,'Maintenance report could not be saved');
 return respond(201,'Maintenance report saved. Photos can now be uploaded.',{ticketId:ticket.id});
}
