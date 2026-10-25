import type {SupabaseClient} from '@supabase/supabase-js';
import {personIssuerFields,type PersonRelationship} from './issuer-person';

// Called only after requireContractAdmin, using that administrator's RLS-bound client.
export async function readIssuerPerson(db:SupabaseClient, currentUserId:string, source:unknown) {
 if(typeof source!=='string' || !/^(self|(relationship|profile):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(source)) {
  return {error:'Select an existing person or your own profile.'};
 }
 let person:PersonRelationship|null=null;
 let profileId=source==='self' ? currentUserId : source.startsWith('profile:') ? source.slice(8) : null;
 const query=db.from('mzs_lease_relationships').select('id,name,kind,address,email,phone,profile_id,billing_address').eq('kind','person');
 const {data:relationship,error:relationshipError}=await (profileId ? query.eq('profile_id',profileId) : query.eq('id',source.slice(13))).maybeSingle();
 if(relationshipError || (!profileId&&!relationship))return {error:'This person could not be loaded. Refresh and try again.'};
 person=relationship;
 profileId=person?.profile_id || profileId;
 if(!profileId)return {fields:personIssuerFields(person,null,null)};
 const profileQuery=db.from('profiles').select('id,full_name,email').eq('id',profileId);
 // Only the signed-in administrator's own profile and client/partner accounts are sources.
 if(profileId!==currentUserId)profileQuery.in('role',['client','partner']);
 const [profile,contact]=await Promise.all([
  profileQuery.maybeSingle(),
  db.from('mzs_member_contact_details').select('phone,street_address,house_number,address_addition,postal_code,city,region,country').eq('user_id',profileId).maybeSingle(),
 ]);
 if(profile.error || !profile.data || contact.error)return {error:'The profile details could not be loaded. No form fields were changed.'};
 return {fields:personIssuerFields(person,profile.data,contact.data)};
}
