'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {euroCents} from '../../../../../../lib/property-operations/sales-reconciliation';
import {invoicePdf} from '../../../../../../lib/estates/invoice-pdf';
import {operationsDay} from '../../../../../../lib/property-operations/action-queues';
import type {FormActionState} from '../../../../../../lib/property-operations/form-state';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=(message='Could not confirm the credit. Refresh before retrying.'):FormActionState=>({status:'error',message});
export async function createCreditDraft(_:FormActionState,f:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin(),id=String(f.get('request_id')),invoice=String(f.get('invoice_id'));if(!uuid.test(id)||!uuid.test(invoice))return fail();
 let lines;try{const amounts=f.getAll('net');if(amounts.length>30)throw Error();lines=amounts.map((n,index)=>({index,net_cents:euroCents(String(n||'0').trim().replace(',','.'))})).filter(l=>l.net_cents>0);}catch{return fail('Enter valid net amounts, with at most two decimal places.');}
 const {data,error}=await db.rpc('mzs_create_service_credit_draft',{p_id:id,p_invoice:invoice,p_spec:{reason:String(f.get('reason')??'').trim(),lines}});if(error||data!==id)return fail(error?.code==='22023'?error.message:undefined);redirect('/admin/workspaces/accountancy/sales/credits/drafts/'+id);
}
export async function issueCredit(_:FormActionState,f:FormData):Promise<FormActionState>{
 const {db}=await requireEstateAdmin(),id=String(f.get('draft_id'));if(!uuid.test(id)||f.get('confirmed')!=='yes')return fail('Confirm the credit preview before issuing.');
 const {data:d,error:e}=await db.from('mzs_service_credit_drafts').select('preview').eq('id',id).single();if(e||!d)return fail();
 try{await invoicePdf({number:'DRAFT CREDIT',issued_on:operationsDay(),due_date:'',total:-d.preview.gross_cents/100,payload:d.preview.payload},'credit');}catch{return fail('PDF validation failed. Review the original issuer details.');}
 const {data,error}=await db.rpc('mzs_issue_service_credit',{p_draft:id});if(error||data!==id)return fail(error?.code==='22023'?error.message:undefined);
 for(const path of ['/admin/workspaces/accountancy/sales','/admin/workspaces/accountancy/sales/receivables','/admin/workspaces/accountancy/sales/issued/'+d.preview.invoice_id,'/admin/workspaces/group'])revalidatePath(path);
 redirect('/admin/workspaces/accountancy/sales/credits/'+id);
}
