'use server';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {revalidatePath} from 'next/cache';
import {revalidateOperations} from '../../../../../lib/property-operations/revalidate';
type Result={status:'idle'|'success'|'error';message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const refresh=()=>{revalidateOperations();revalidatePath('/admin/workspaces/estates/zorgbalans');};
export async function prepareZorgbalansInvoice(_previous:Result,form:FormData):Promise<Result>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const number=String(form.get('invoice_number')??'').trim();
 const issuedOn=String(form.get('issued_on')??'');
 const ids=form.getAll('visit_id').map(String);
 if(!/^[0-9]{3,16}$/.test(number)||!date.test(issuedOn)||
  !Number.isFinite(Date.parse(issuedOn+'T00:00:00Z'))||
  new Date(issuedOn+'T00:00:00Z').toISOString().slice(0,10)!==issuedOn||
  ids.length<1||ids.length>100||ids.some(id=>!uuid.test(id))||new Set(ids).size!==ids.length)
  return {status:'error',message:'Choose approved visits, a valid private invoice number and an issue date.'};
 const {data,error}=await db.rpc('mzs_ops_prepare_zorgbalans_invoice',{
  p_number:number,p_visit_ids:ids,p_issued_on:issuedOn
 });
 if(error||typeof data!=='string'||!uuid.test(data))
  return {status:'error',message:'Invoice concept not prepared. Check the number, approved time and prior invoices. Nothing was sent.'};
 refresh();return {status:'success',message:'Private invoice concept prepared. Download the PDF and verify it before sending.'};
}
export async function confirmZorgbalansInvoice(_previous:Result,form:FormData):Promise<Result>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const invoiceId=String(form.get('invoice_id')??'');
 const reason=String(form.get('confirmation_note')??'').trim();
 if(!uuid.test(invoiceId)||reason.length<8||reason.length>500||/[\u0000-\u001f\u007f]/u.test(reason))
  return {status:'error',message:'Enter a valid invoice and a delivery reference of at least 8 characters.'};
 const {data,error}=await db.rpc('mzs_ops_confirm_zorgbalans_invoice',{
  p_id:invoiceId,p_reason:reason
 });
 if(error||data!==true)return {status:'error',message:'Confirmation not recorded. Check the invoice status and try again.'};
 refresh();return {status:'success',message:'External delivery was recorded; no email was sent by this platform.'};
}
