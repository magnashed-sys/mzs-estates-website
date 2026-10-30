'use server';
import {notFound,redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '../lib/supabase/server';
import {requireStaffEnvironment} from '../lib/security/property-staff';
import {requireEstateAdmin} from '../lib/security/estate-properties';
import {archiveEntities} from '../lib/accountancy/archive-data';
import {annualSource} from '../lib/accountancy/administration-data';
import {allRows} from '../lib/property-operations/staff-data';
import type {SupplierIdentity} from '../lib/accountancy/supplier-integrity';
import {completenessItems} from '../lib/accountancy/completeness';
import {followupInput,selectedFollowups,followupUpdate,type FollowupResult} from '../lib/accountancy/followups';
import {dateInput,optionalUuid} from '../lib/property-operations/task-input';
function refresh(){revalidatePath('/admin/workspaces/accountancy/completeness');revalidatePath('/staff/follow-ups');}
export async function createFollowups(_state:FollowupResult,form:FormData):Promise<FollowupResult>{
 const {db}=await requireEstateAdmin();
 try{
  const input=followupInput(form);
  const [source,suppliers,entities]=await Promise.all([annualSource(db,input.year),allRows<SupplierIdentity>((a,b)=>db.from('mzs_lease_relationships').select('id,name,kind,company_details',{count:'exact'}).order('id').range(a,b)),archiveEntities(db)]);
  const context=(entities.find(e=>e.id===source.administration.issuer_id)?.name??source.administration.issuer_id)+' · '+source.administration.fiscal_year;
  const selected=selectedFollowups(input.keys,completenessItems(source,suppliers)).map(item=>({...item,label:(context+' · '+item.label).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,240)}));
  const {data,error}=await db.rpc('mzs_create_accountancy_followups',{p_year:input.year,p_items:selected,p_assignee:input.assignee,p_due:input.due});
  if(error||typeof data!=='number')return {status:'error',message:'save_failed'};
  refresh();return {status:'success',message:'created',count:data};
 }catch{return {status:'error',message:'refresh_source'};}
}
export async function updateFollowup(_state:FollowupResult,form:FormData):Promise<FollowupResult>{
 requireStaffEnvironment();const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)redirect('/login');
 const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profileError||!profile?.is_active)notFound();
 try{
  const input=followupUpdate(form);const admin=profile.role==='admin';
  const changes:{status:string;note:string;revision:number;assigned_profile_id?:string|null;due_on?:string|null}={status:input.status,note:input.note,revision:input.revision+1};
  if(admin){const due=String(form.get('due_on')??'');if(due&&!dateInput(due))throw Error('date');changes.due_on=due||null;changes.assigned_profile_id=optionalUuid(String(form.get('assigned_profile_id')??''));}
  let query=db.from('mzs_accountancy_followups').update(changes).eq('id',input.id).eq('revision',input.revision);
  if(!admin)query=query.eq('assigned_profile_id',user.id);
  const {data,error}=await query.select('id').maybeSingle();
  if(error||!data)return {status:'error',message:'stale'};
  refresh();return {status:'success',message:'saved'};
 }catch{return {status:'error',message:'invalid'};}
}
