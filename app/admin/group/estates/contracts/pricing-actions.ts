'use server';
import {revalidatePath} from 'next/cache';
import {requireContractAdmin} from '../../../../../lib/security/estate-contracts';
import {uuid} from '../../../../../lib/accountancy/administration';
import {validPricing,type PricingBasis,type LineRole} from '../../../../../lib/estates/lease-pricing';
const path='/admin/group/estates/contracts';
export async function classifyLease(id:string,version:number,basis:PricingBasis,roles:LineRole[],reviewDate:string,clause:string){
 const {db}=await requireContractAdmin();
 if(!uuid.test(id)||!Number.isSafeInteger(version)||!['separate','all_in'].includes(basis)||!validPricing(basis,roles,roles.length)||clause.length>2000)return {error:'Check the pricing classification.'};
 const {data,error}=await db.from('mzs_lease_contracts').update({pricing_basis:basis,line_roles:roles,indexation_review_on:reviewDate||null,indexation_clause:clause}).eq('id',id).eq('version',version).eq('pricing_basis','unclassified').select('id').maybeSingle();
 if(error||!data)return {error:error?.message||'This contract changed. Refresh before saving.'};
 revalidatePath(path);return {ok:true};
}
export async function proposeLeaseAdjustment(f:FormData){
 const {db}=await requireContractAdmin();const id=String(f.get('contract_id')||''),effective=String(f.get('effective_on')||''),kind=String(f.get('kind')||''),evidence=String(f.get('evidence')||'').trim();
 if(!uuid.test(id)||!/^20\d{2}-\d{2}-01$/.test(effective)||!['indexation','advance'].includes(kind)||evidence.length<5||evidence.length>2000)return {error:'Check the calculation, date and supporting reference.'};
 const keys=['method','percentage','old_index','new_index','ceiling','annual_budget','months','line_index'];
 const input=Object.fromEntries(keys.map(k=>[k,String(f.get(k)||'')]));
 if(Object.values(input).some(v=>v.length>30))return {error:'Invalid calculation input.'};
 const {error}=await db.rpc('mzs_propose_lease_adjustment',{p_contract:id,p_effective:effective,p_kind:kind,p_input:input,p_evidence:evidence});
 if(error)return {error:error.message};revalidatePath(path);return {ok:true};
}
export async function decideLeaseAdjustment(id:string,approve:boolean,note:string){
 const {db}=await requireContractAdmin();
 if(!uuid.test(id)||typeof approve!=='boolean'||note.trim().length<5||note.length>2000)return {error:'Record the review or cancellation reason.'};
 const {error}=await db.rpc('mzs_decide_lease_adjustment',{p_id:id,p_approve:approve,p_note:note.trim()});
 if(error)return {error:error.message};revalidatePath(path);return {ok:true};
}
