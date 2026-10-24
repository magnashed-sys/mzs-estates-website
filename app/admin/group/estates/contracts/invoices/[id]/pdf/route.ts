import {requireContractAdmin} from '../../../../../../../../lib/security/estate-contracts';
import {invoicePdf} from '../../../../../../../../lib/estates/invoice-pdf';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {db}=await requireContractAdmin();const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('Not found',{status:404});
 const {data,error}=await db.from('mzs_lease_invoices').select('*').eq('id',id).maybeSingle();
 if(error||!data)return new Response('Not found',{status:404});
 const bytes=await invoicePdf(data);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${data.number}.pdf"`,'Cache-Control':'private, no-store'}});
}
