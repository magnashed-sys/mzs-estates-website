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
export async function decideOwnerStay(form:FormData){
 const {db}=await requireEstateAdmin();
 const id=String(form.get('request_id')||'');
 const choice=String(form.get('decision')||'');
 if(!UUID.test(id)||!['approve','decline'].includes(choice))throw Error('Invalid decision');
 const {error}=await db.rpc('mzs_admin_decide_owner_stay',{p_request_id:id,p_approve:choice==='approve'});
 if(error)throw Error(error.message||'Approval failed');
 revalidatePath(path);
 revalidatePath('/admin');
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
