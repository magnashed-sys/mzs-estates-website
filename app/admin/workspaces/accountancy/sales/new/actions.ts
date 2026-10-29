'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {euroCents} from '../../../../../../lib/property-operations/sales-reconciliation';
import {invoicePdf} from '../../../../../../lib/estates/invoice-pdf';
import type {FormActionState} from '../../../../../../lib/property-operations/form-state';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const value=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const failed=(message='Could not confirm this operation. Refresh before retrying.'):FormActionState=>({status:'error',message});
export async function createDraft(_:FormActionState,f:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();const id=value(f,'request_id'),issuer=value(f,'issuer_id'),customer=value(f,'customer_id');if(![id,issuer,customer].every(x=>uuid.test(x)))return failed('Select an entity and customer.');
 const fields=['subject','address','due_on','reference','attention','tax_id','terms'];const spec:Record<string,unknown>=Object.fromEntries(fields.map(k=>[k,value(f,k)]));
 try{const descriptions=f.getAll('description'),qty=f.getAll('quantity'),price=f.getAll('unit_price'),vat=f.getAll('vat');if(descriptions.length>30||[qty,price,vat].some(a=>a.length!==descriptions.length))throw Error();spec.lines=descriptions.map((d,i)=>({description:String(d).trim(),quantity:String(qty[i]).trim().replace(',','.'),unit_cents:euroCents(String(price[i]).trim().replace(',','.')),vat:String(vat[i]).trim().replace(',','.')}));}catch{return failed('Check the amounts and invoice lines.');}
 const {data,error}=await db.rpc('mzs_create_service_draft',{p_id:id,p_issuer:issuer,p_customer:customer,p_spec:spec});if(error||data!==id)return failed(error?.code==='22023'?error.message:undefined);
 revalidatePath('/admin/workspaces/accountancy/sales/new');redirect('/admin/workspaces/accountancy/sales/drafts/'+id);
}
export async function issueDraft(_:FormActionState,f:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();const id=value(f,'draft_id');if(!uuid.test(id)||f.get('confirmed')!=='yes')return failed('Review and confirm the draft before issuing.');
 const {data:d,error:readError}=await db.from('mzs_service_invoice_drafts').select('*').eq('id',id).single();if(readError||!d)return failed();
 try{await invoicePdf({number:'DRAFT',issued_on:new Date().toISOString().slice(0,10),due_date:d.due_on,total:d.gross_cents/100,payload:d.payload},'service');}catch{return failed('PDF validation failed. Create a corrected draft before issuing.');}
 const {data,error}=await db.rpc('mzs_issue_service_invoice',{p_draft:id});if(error||!data)return failed(error?.code==='22023'?error.message:undefined);
 for(const path of ['/admin/workspaces/accountancy/sales','/admin/workspaces/accountancy/sales/new','/admin/workspaces/group'])revalidatePath(path);redirect('/admin/workspaces/accountancy/sales/issued/'+data);
}
export async function cancelDraft(_:FormActionState,f:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();const id=value(f,'draft_id');if(!uuid.test(id)||f.get('confirmed')!=='yes')return failed('Confirm cancellation.');
 const {error}=await db.rpc('mzs_cancel_service_draft',{p_draft:id,p_reason:value(f,'reason')});if(error)return failed(error.code==='22023'?error.message:undefined);revalidatePath('/admin/workspaces/accountancy/sales/new');redirect('/admin/workspaces/accountancy/sales/new');
}
