'use server';
import {revalidatePath} from 'next/cache';
import {deliverOwnerStayAdminNotifications} from '../../../lib/mzs/notifications';
import {createClient} from '../../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../../lib/security/phase3a-preview-isolation';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function requestOwnerStay(form:FormData){
 if(!isPhase3aPreviewIsolated())throw Error('Not available');
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)throw Error('Sign in required');
 const partner=String(form.get('partner_id')||'');
 const check_in=String(form.get('check_in')||'');
 const check_out=String(form.get('check_out')||'');
 const guest_count=Number(form.get('guest_count'));
 const notes=String(form.get('notes')||'').trim();
 if(!UUID.test(partner)||!/^\d{4}-\d{2}-\d{2}$/.test(check_in)||!/^\d{4}-\d{2}-\d{2}$/.test(check_out)
 ||check_out<=check_in||!Number.isInteger(guest_count)||guest_count<1||guest_count>30||notes.length>1500)throw Error('Invalid stay');
 const {data:grant}=await db.from('mzs_property_partners').select('id').eq('id',partner).eq('profile_id',user.id).eq('is_active',true).eq('complimentary_owner_stays',true).eq('requires_approval',true).single();
 if(!grant)throw Error('Owner access unavailable');
 const {data:request,error}=await db.from('mzs_owner_stay_requests').insert({partner_id:partner,check_in,check_out,guest_count,notes}).select('id').single();
 if(error||!request)throw Error('Could not submit owner-stay request');
 await deliverOwnerStayAdminNotifications(request.id);
 revalidatePath('/private/owner-stays');
}
