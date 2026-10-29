'use server';
import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import type {FormActionState} from '../../../../../../lib/property-operations/form-state';
import {prepareReminderDelivery} from '../../../../../../lib/finance/reminder-delivery';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const value=(f:FormData,k:string)=>String(f.get(k)??'').trim();
function target(f:FormData){const source=value(f,'source'),id=value(f,'invoice_id'),request=value(f,'request_id');if(!['service','external','archive','rental','booking'].includes(source)||!uuid.test(id)||!uuid.test(request))throw Error('Invalid invoice request');return {source,id,request};}
const errorState=(message:string):FormActionState=>({status:'error',message});
function refresh(source:string,id:string){revalidatePath('/admin/workspaces/accountancy/sales/receivables');revalidatePath(`/admin/workspaces/accountancy/sales/receivables/${source}/${id}`);}
export async function saveFollowUp(_previous:FormActionState,form:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();let t;try{t=target(form);}catch{return errorState('Invalid invoice request.');}
 const expected=value(form,'revision'),note=value(form,'note'),next=value(form,'next_on');
 if(!/^\d{1,9}$/.test(expected)||note.length<3||note.length>2000||next&&!/^20\d{2}-\d{2}-\d{2}$/.test(next))return errorState('Check the note and follow-up date.');
 const {data,error}=await db.rpc('mzs_save_invoice_follow_up',{p_id:t.request,p_source:t.source,p_invoice:t.id,p_expected:Number(expected),p_note:note,p_next:next||null});
 if(error||data!==t.request)return errorState(error?.code==='22023'?error.message:'Follow-up could not be saved. Refresh before retrying.');
 refresh(t.source,t.id);return {status:'success',message:'Follow-up saved. Previous notes remain in the history.'};
}
export async function sendReminder(_previous:FormActionState,form:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin();let t;try{t=target(form);}catch{return errorState('Invalid invoice request.');}
 if(form.get('confirmed')!=='yes')return errorState('Review the recipient, outstanding balance and message, then confirm.');
 const {data:snapshot,error:readError}=await db.rpc('mzs_invoice_reminder_context',{p_source:t.source,p_invoice:t.id});
 if(readError||!snapshot||createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')!==value(form,'preview'))return errorState('Balance or recipient changed. Refresh and review the preview again.');
 let deliver;try{deliver=prepareReminderDelivery();}catch{return errorState('Email delivery is not enabled or configured for this environment. No reminder was sent.');}
 const {data,error}=await db.rpc('mzs_claim_invoice_reminder',{p_id:t.request,p_source:t.source,p_invoice:t.id,p_expected:snapshot});
 if(error||!data)return errorState(error?.code==='22023'?error.message:'Reminder could not be claimed. Check the history before retrying.');
 let status='uncertain';try{status=await deliver(t.request,data);}catch{/* Claimed requests without a result stay blocked for manual investigation. */}
 refresh(t.source,t.id);
 return status==='accepted'?{status:'success',message:'Reminder accepted by the mail server. This does not confirm delivery or that it was read.'}:status==='captured'?{status:'success',message:'Test reminder captured. No external email was sent.'}:errorState(status==='failed'?'Mail server did not accept the reminder. See delivery history.':'Delivery outcome is uncertain. Do not send again until the mail logs have been checked.');
}
