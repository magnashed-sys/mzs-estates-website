'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const path='/admin/owner-stays';
export async function grantPartner(form:FormData){
 const {db}=await requireEstateAdmin();
 const user=String(form.get('profile_id')||'');
 const project=String(form.get('project_id')||'');
 if(!UUID.test(user)||!UUID.test(project))throw Error('Invalid account or property');
 const {data:person}=await db.from('profiles').select('role,is_active').eq('id',user).single();
 if(!person?.is_active||!['client','partner'].includes(person.role))throw Error('Account not eligible');
 const {data:offering,error:offeringError}=await db.from('offerings').select('id').eq('project_id',project).eq('offering_type','rental').eq('status','active').limit(1);
 if(offeringError||!offering?.length)throw Error('Only active rental properties can be assigned');
 const {error}=await db.from('mzs_property_partners').upsert({
   profile_id:user,project_id:project,complimentary_owner_stays:true,
   requires_approval:true,is_active:true
 },{onConflict:'project_id,profile_id'});
 if(error)throw Error('Partner grant could not be saved');
 revalidatePath(path);
}
export type OwnerStayDecisionResult={status:'idle'|'success'|'error';message:string};
export async function deleteOwnerStayRequest(
 _previous:OwnerStayDecisionResult,form:FormData
):Promise<OwnerStayDecisionResult>{
 const {db}=await requireEstateAdmin();
 const id=String(form.get('request_id')||'');
 const reason=String(form.get('reason')||'').trim();
 const status=String(form.get('expected_status')||'');
 const checkIn=String(form.get('check_in')||'');
 const checkOut=String(form.get('check_out')||'');
 if(!UUID.test(id)||reason.length<5||reason.length>500||!['declined','cancelled'].includes(status)||
    !/^\d{4}-\d{2}-\d{2}$/.test(checkIn)||!/^\d{4}-\d{2}-\d{2}$/.test(checkOut))
  return {status:'error',message:'Provide a deletion reason of 5–500 characters and refresh if the request has changed.'};
 const {data,error}=await db.rpc('mzs_admin_delete_closed_owner_stay',{
  p_request_id:id,p_reason:reason,p_expected_status:status,p_check_in:checkIn,p_check_out:checkOut
 });
 if(error||data!==true)return {status:'error',message:'Deletion was not confirmed. The request may have changed or have a linked reservation. Refresh and review it before trying again.'};
 revalidatePath(path);
 revalidatePath('/admin');
 revalidatePath('/admin/bookings');
 revalidatePath('/admin/unified-bookings');
 return {status:'success',message:'Closed owner-stay request deleted. An audit record has been retained.'};
}
/**
 * A calendar conflict is a normal business validation outcome, not a fatal
 * Next.js Server Action error. Never overwrite an existing booked period.
 */
export async function decideOwnerStay(
 _previous:OwnerStayDecisionResult,form:FormData
):Promise<OwnerStayDecisionResult>{
 const {db}=await requireEstateAdmin();
 const id=String(form.get('request_id')||'');
 const choice=String(form.get('decision')||'');
 if(!UUID.test(id)||!['approve','decline'].includes(choice))
   return {status:'error',message:'Invalid request or decision. Refresh the page.'};
 const {error}=await db.rpc('mzs_admin_decide_owner_stay',{p_request_id:id,p_approve:choice==='approve'});
 if(error){
   const message=error.message||'';
   if(message.includes('Dates are no longer available'))
     return {status:'error',message:'This stay overlaps an existing confirmed reservation or blocked period. No owner stay was approved. Review the availability and existing booking dates first.'};
   if(message.includes('Past dates unavailable'))
     return {status:'error',message:'This request starts in the past and can no longer be approved.'};
   if(message.includes('Request unavailable or reviewed'))
     return {status:'error',message:'This request was already reviewed or has changed. Refresh the page before trying again.'};
   if(message.includes('Partner owner-stay grant inactive'))
     return {status:'error',message:'The property partner permission is no longer active. No booking was created.'};
   return {status:'error',message:'The request could not be processed. Refresh the page and check its status before retrying.'};
 }
 revalidatePath(path);
 revalidatePath('/admin');
 revalidatePath('/admin/bookings');
 return {status:'success',message:choice==='approve'?'Owner stay approved. The confirmed booking is now recorded.':'Owner stay request declined.'};
}
export async function adjustBookingPrice(form:FormData){
 const {db}=await requireEstateAdmin();
 const id=String(form.get('booking_id')||'');
 const input=String(form.get('total')||'');
 const initial=String(form.get('expected')||'');
 const reason=String(form.get('reason')||'').trim();
 if(!UUID.test(id)||!/^\d+(?:\.\d{1,2})?$/.test(input)||reason.length<5||reason.length>500)throw Error('Invalid amount or reason');
 const expected=initial===''?null:Number(initial);
 if(initial!==''&&(!Number.isFinite(expected)||expected < 0))throw Error('Invalid prior amount');
 const {error}=await db.rpc('mzs_admin_set_booking_total',{p_booking_id:id,p_expected_total:expected,p_total:Number(input),p_reason:reason});
 if(error)throw Error(error.message||'Price update failed');
 revalidatePath(path);
 revalidatePath('/admin');
}

