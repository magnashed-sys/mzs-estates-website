'use server';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {revalidatePath} from 'next/cache';
import {revalidateOperations} from '../../../../../lib/property-operations/revalidate';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {MAX_BILLING_VISITS} from '../../../../../lib/property-operations/zorgbalans-billing';
type Result={status:'idle'|'success'|'error';message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const refresh=()=>{revalidateOperations();revalidatePath('/admin/workspaces/estates/zorgbalans');};
export async function prepareZorgbalansInvoice(_previous:Result,form:FormData):Promise<Result>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const {language}=await getAdminI18n();
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const number=String(form.get('invoice_number')??'').trim();
 const issuedOn=String(form.get('issued_on')??'');
 const ids=form.getAll('visit_id').map(String);
 if(!/^[0-9]{3,16}$/.test(number)||!date.test(issuedOn)||
  !Number.isFinite(Date.parse(issuedOn+'T00:00:00Z'))||
  new Date(issuedOn+'T00:00:00Z').toISOString().slice(0,10)!==issuedOn||
  ids.length<1||ids.length>MAX_BILLING_VISITS||ids.some(id=>!uuid.test(id))||new Set(ids).size!==ids.length)
  return {status:'error',message:tr('Choose 1–100 approved visits, a valid private invoice number and an issue date.','Seleccione entre 1 y 100 visitas aprobadas, un número de factura privada válido y una fecha de emisión.')};
 const {data,error}=await db.rpc('mzs_ops_prepare_zorgbalans_invoice',{
  p_number:number,p_visit_ids:ids,p_issued_on:issuedOn
 });
 if(error||typeof data!=='string'||!uuid.test(data))
  return {status:'error',message:tr('Invoice draft not prepared. Check the number, approved time and prior invoices. Nothing was sent.','No se ha creado el borrador. Compruebe el número, las horas aprobadas y las facturas anteriores. No se ha enviado nada.')};
 refresh();return {status:'success',message:tr('Private invoice draft prepared. Download the PDF and verify it before sending.','Borrador de factura privada preparado. Descargue el PDF y compruébelo antes de enviarlo.')};
}
export async function confirmZorgbalansInvoice(_previous:Result,form:FormData):Promise<Result>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const {language}=await getAdminI18n();
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const invoiceId=String(form.get('invoice_id')??'');
 const reason=String(form.get('confirmation_note')??'').trim();
 if(!uuid.test(invoiceId)||reason.length<8||reason.length>500||/[\u0000-\u001f\u007f]/u.test(reason))
  return {status:'error',message:tr('Enter a valid invoice and a delivery reference of at least 8 characters.','Introduzca una factura válida y una referencia de envío de al menos 8 caracteres.')};
 const {data,error}=await db.rpc('mzs_ops_confirm_zorgbalans_invoice',{
  p_id:invoiceId,p_reason:reason
 });
 if(error||data!==true)return {status:'error',message:tr('Confirmation not recorded. Check the invoice status and try again.','No se ha registrado la confirmación. Compruebe el estado de la factura e inténtelo de nuevo.')};
 refresh();return {status:'success',message:tr('External delivery was recorded; no email was sent by this platform.','Se ha registrado el envío externo; esta plataforma no ha enviado ningún correo.')};
}
