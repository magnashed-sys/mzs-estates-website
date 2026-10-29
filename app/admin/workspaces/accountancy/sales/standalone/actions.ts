'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {euroCents,dateYear} from '../../../../../../lib/property-operations/sales-reconciliation';
import {operationsDay} from '../../../../../../lib/property-operations/action-queues';
import type {FormActionState} from '../../../../../../lib/property-operations/form-state';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const value=(form:FormData,key:string)=>String(form.get(key)??'').trim();
function refresh(invoice:string){for(const path of ['/admin/workspaces/accountancy/sales','/admin/workspaces/accountancy/sales/standalone/'+invoice,'/admin/workspaces/accountancy/sales/imported/'+invoice,'/admin/workspaces/estates/history','/admin/workspaces/estates/reports'])revalidatePath(path);}
function failed(error?:{code?:string;message?:string}|null):FormActionState{return {status:'error',message:error?.code==='22023'&&error.message?error.message:'Payment could not be confirmed. Refresh the invoice before changing or retrying the entry.'};}
export async function recordExternalReceipt(_previous:FormActionState,form:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();const source=value(form,'source')||'external';if(!['external','archive'].includes(source))return failed();
 const id=value(form,'request_id'),invoice=value(form,'invoice_id'),raw=value(form,'amount').replace(',','.'),date=value(form,'received_on'),reference=value(form,'reference');
 let amount:number;try{amount=euroCents(raw);if(dateYear(date)===null)throw Error();}catch{return {status:'error',message:'Enter a valid amount and payment date.'};}
 if(!uuid.test(id)||!uuid.test(invoice)||amount<=0||date<'2000-01-01'||date>operationsDay()||reference.length<3||reference.length>200||/[\u0000-\u001f\u007f]/u.test(reference)||form.get('confirmed')!=='yes')return {status:'error',message:'Check the amount, date, bank reference and confirmation.'};
 const {data,error}=await db.rpc(source==='archive'?'mzs_record_archive_invoice_receipt':'mzs_record_external_invoice_receipt',{p_id:id,p_invoice:invoice,p_amount_cents:amount,p_received_on:date,p_reference:reference});
 if(error||data!==id)return failed(error);refresh(invoice);return {status:'success',message:'Payment recorded. The invoice balance has been updated.'};
}
export async function reverseExternalReceipt(_previous:FormActionState,form:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();const source=value(form,'source')||'external';if(!['external','archive'].includes(source))return failed();const id=value(form,'receipt_id'),invoice=value(form,'invoice_id'),reason=value(form,'reason');
 if(!uuid.test(id)||!uuid.test(invoice)||reason.length<8||reason.length>500||/[\u0000-\u001f\u007f]/u.test(reason)||form.get('confirmed')!=='yes')return {status:'error',message:'Enter a reason of 8 to 500 characters and confirm the administrative reversal.'};
 const {data,error}=await db.rpc(source==='archive'?'mzs_reverse_archive_invoice_receipt':'mzs_reverse_external_invoice_receipt',{p_id:id,p_invoice:invoice,p_reason:reason});
 if(error||data!==id)return failed(error);refresh(invoice);return {status:'success',message:'Payment registration reversed. The original record remains in the history. No bank refund was made.'};
}
