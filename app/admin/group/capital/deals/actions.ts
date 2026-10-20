'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireDealsAdmin } from '../../../../../lib/security/capital-deals';

import { deliverForCapitalGrant } from '../../../../../lib/mzs/notifications';

const ROOT='/admin/group/capital/deals';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function str(f:FormData,key:string,max:number,min=0) {
 const v=f.get(key);if(typeof v!=='string'||v.trim().length<min||v.trim().length>max) throw new Error('invalid');return v.trim();
}
function id(f:FormData,key:string) { const v=str(f,key,36,36);if(!uuid.test(v))throw new Error('invalid');return v; }
function choice(f:FormData,key:string,values:string[]) {const v=str(f,key,40);if(!values.includes(v))throw new Error('invalid');return v;}
function decimal(f:FormData,key:string,max:number,zero=false,places=2) {
 const v=str(f,key,24,1);if(!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(v))throw new Error('invalid');
 const n=Number(v);if(!Number.isFinite(n)||n>max||n<(zero?0:0.01))throw new Error('invalid');return v;
}
function day(f:FormData,key:string,required=false) {
 const v=str(f,key,10);if(!v&&!required)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw new Error('invalid');return v;
}
function finish(path:string,ok:boolean) { revalidatePath(ROOT,'layout');redirect(path+'?notice='+(ok?'saved':'failed')); }

export async function saveDeal(f:FormData) {
 const {db}=await requireDealsAdmin();let saved:string|null=null;let existing='';
 try {
  existing=str(f,'id',36);if(existing&&!uuid.test(existing))throw new Error('invalid');
  const row={title:str(f,'title',160,2),direction:choice(f,'direction',['provided','received']),
   lender:str(f,'lender',200,2),borrower:str(f,'borrower',200,2),principal:decimal(f,'principal',99999999999999),
   annual_rate:decimal(f,'annual_rate',100,true,4),agreement_date:day(f,'agreement_date'),start_date:day(f,'start_date'),
   maturity_date:day(f,'maturity_date'),status:choice(f,'status',['draft','in_discussion','agreed','active','completed']),
   review_state:choice(f,'review_state',['needs_review','reviewed']),notes:str(f,'notes',8000),source_reference:str(f,'source_reference',2000)};
  if(row.maturity_date&&row.start_date&&row.maturity_date<row.start_date)throw new Error('invalid');
  const result=existing?await db.from('mzs_capital_deals').update(row).eq('id',existing).select('id').single():await db.from('mzs_capital_deals').insert(row).select('id').single();
  if(!result.error)saved=result.data?.id;
 }catch{ /* Return a non-sensitive message; database and submitted values stay private. */ }
 finish(saved?ROOT+'/'+saved:ROOT,saved!==null);
}

export async function addInstalment(f:FormData) {
 const {db}=await requireDealsAdmin();let deal='';let ok=false;
 try {deal=id(f,'deal_id');const {error}=await db.from('mzs_capital_instalments').insert({deal_id:deal,
  kind:choice(f,'kind',['interest','principal','fee']),period_label:str(f,'period_label',120),
  due_date:day(f,'due_date',true),amount:decimal(f,'amount',99999999999999),note:str(f,'note',1000)});ok=!error;
 }catch{}
 finish(uuid.test(deal)?ROOT+'/'+deal:ROOT,ok);
}

export async function recordPayment(f:FormData) {
 const {db}=await requireDealsAdmin();let deal='';let ok=false;
 try {deal=id(f,'deal_id');const instalment=id(f,'instalment_id');
  const {data,error}=await db.from('mzs_capital_instalments').select('id').eq('id',instalment).eq('deal_id',deal).single();
  if(error||!data)throw new Error('invalid');
  const {error:insertError}=await db.from('mzs_capital_payments').insert({id:id(f,'payment_id'),instalment_id:instalment,
   amount:decimal(f,'amount',99999999999999),paid_on:day(f,'paid_on',true),reference:str(f,'reference',300,2)});
  // A retry of the same form carries the same primary key: never book twice.
  ok=!insertError;
 }catch{}
 finish(uuid.test(deal)?ROOT+'/'+deal:ROOT,ok);
}

export async function voidPayment(f:FormData) {
 const {db}=await requireDealsAdmin();let deal='';let ok=false;
 try {deal=id(f,'deal_id');const payment=id(f,'payment_id');
  const {data:row,error}=await db.from('mzs_capital_payments').select('instalment_id').eq('id',payment).single();
  if(error||!row)throw new Error('invalid');
  const {data:inst}=await db.from('mzs_capital_instalments').select('id').eq('id',row.instalment_id).eq('deal_id',deal).single();
  if(!inst)throw new Error('invalid');
  const {data,error:e}=await db.from('mzs_capital_payments').update({is_void:true,void_reason:str(f,'void_reason',500,3)}).eq('id',payment).eq('is_void',false).select('id').single();ok=!e&&!!data;
 }catch{}
 finish(uuid.test(deal)?ROOT+'/'+deal:ROOT,ok);
}

function finishAccess(deal:string,ok:boolean,mail:string){
 revalidatePath('/private');revalidatePath('/private/capital');revalidatePath(ROOT,'layout');
 redirect((uuid.test(deal)?ROOT+'/'+deal:ROOT)+'?notice='+(ok?'saved':'failed')+(ok&&mail?'&mail='+mail:''));
}
function accessFields(f:FormData){
 if(f.get('confirm_access')!=='yes')throw new Error('confirmation required');
 return {party_role:choice(f,'party_role',['lender','borrower']),display_label:str(f,'display_label',120,2)};
}
export async function grantClientAccess(f:FormData){
 const {db}=await requireDealsAdmin();let deal='';let ok=false;let mail='';
 try{
  deal=id(f,'deal_id');const userId=id(f,'user_id');const fields=accessFields(f);
  const {data:p,error:pe}=await db.from('profiles').select('role,is_active').eq('id',userId).single();
  if(pe||!p?.is_active||!['client','partner'].includes(p.role))throw new Error('invalid recipient');
  const {data:d,error:de}=await db.from('mzs_capital_deals').select('id').eq('id',deal).single();
  if(de||!d)throw new Error('invalid dossier');
  // Insert only: duplicate submissions cannot silently reactivate a revoked grant.
  const {data,error}=await db.from('mzs_capital_client_access').insert({deal_id:deal,user_id:userId,...fields,is_active:true}).select('id').single();
  ok=!error&&!!data;
  if(ok) mail=await deliverForCapitalGrant(userId,data.id)?"sent":"pending";
 }catch{}
 finishAccess(deal,ok,mail);
}
export async function updateClientAccess(f:FormData){
 const {db}=await requireDealsAdmin();let deal='';let ok=false;let mail='';
 try{
  deal=id(f,'deal_id');const grant=id(f,'grant_id');const fields=accessFields(f);
  const active=choice(f,'is_active',['true','false'])==='true';
  const {data:g,error:ge}=await db.from('mzs_capital_client_access').select('user_id').eq('id',grant).eq('deal_id',deal).single();
  if(ge||!g)throw new Error('invalid grant');
  if(active){const {data:p,error:pe}=await db.from('profiles').select('role,is_active').eq('id',g.user_id).single();if(pe||!p?.is_active||!['client','partner'].includes(p.role))throw new Error('invalid recipient');}
  const expectedActive=choice(f,'expected_active',['true','false'])==='true';
  const {data,error}=await db.from('mzs_capital_client_access').update({...fields,is_active:active}).eq('id',grant).eq('deal_id',deal)
   .eq('is_active',choice(f,'expected_active',['true','false'])==='true')
   .eq('party_role',choice(f,'expected_role',['lender','borrower'])).eq('display_label',str(f,'expected_label',120,2)).select('id').single();
  ok=!error&&!!data;
  if(ok&&active&&!expectedActive) mail=await deliverForCapitalGrant(g.user_id,grant)?"sent":"pending";
 }catch{}
 finishAccess(deal,ok,mail);
}
export async function revokeClientAccess(f:FormData){
 const {db}=await requireDealsAdmin();let deal='';let ok=false;
 try{
  deal=id(f,'deal_id');
  const {data,error}=await db.from('mzs_capital_client_access').update({is_active:false}).eq('id',id(f,'grant_id')).eq('deal_id',deal).eq('is_active',true).select('id').single();
  ok=!error&&!!data;
 }catch{}
 revalidatePath('/private');revalidatePath('/private/capital');
 finish(uuid.test(deal)?ROOT+'/'+deal:ROOT,ok);
}
