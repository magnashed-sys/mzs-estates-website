import {requireContractAdminApi} from '../../../../../../../../lib/security/contract-admin-api';
import {invoicePdf} from '../../../../../../../../lib/estates/invoice-pdf';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await requireContractAdminApi();if('response' in actor)return actor.response;const {db}=actor;const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('Not found',{status:404});
 const draft=new URL(request.url).searchParams.get('draft')==='1';
 const {data,error}=await db.from(draft?'mzs_lease_invoice_drafts':'mzs_lease_invoices').select('*').eq('id',id).maybeSingle();
 if(error||!data)return new Response('Not found',{status:404});
 const invoice=draft?{number:'CONCEPT - NIET UITGEGEVEN',issued_on:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam'}).format(new Date()),due_date:data.due_date,total:data.total,payload:data}:data;
 const bytes=await invoicePdf(invoice);const filename=draft?'Concept':String(data.number).replace(/[^A-Za-z0-9-]/g,'_');
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${filename}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
