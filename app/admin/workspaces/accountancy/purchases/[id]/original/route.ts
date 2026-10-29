import {createHash} from 'node:crypto';
import {requirePdfAdmin} from '../../../../../../../lib/accountancy/pdf/server';
import {PDF_BUCKET} from '../../../../../../../lib/accountancy/pdf/model';
import {uuid} from '../../../../../../../lib/accountancy/administration';
export const runtime='nodejs';
const unavailable=()=>new Response('Original unavailable',{status:404,headers:{'Cache-Control':'private, no-store'}});
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {db}=await requirePdfAdmin(),{id}=await params;if(!uuid.test(id))return unavailable();
 const intake=await db.from('mzs_purchase_pdf_intakes').select('*').eq('id',id).maybeSingle();if(intake.error||!intake.data)return unavailable();const i=intake.data;
 const result=await db.from('mzs_purchase_pdf_results').select('sha256,verdict').eq('intake_id',id).maybeSingle();if(result.error||result.data?.verdict!=='clean'||result.data.sha256!==i.sha256)return unavailable();
 const file=await db.storage.from(PDF_BUCKET).download(i.file_path);if(file.error||!file.data||file.data.size!==i.file_size)return unavailable();const bytes=Buffer.from(await file.data.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==i.sha256)return unavailable();
 return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="purchase-${id}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
