import {createHash,randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {requirePdfAdmin,pdfProcessingReady,processingClient,scannerOptions} from '../../../../../../lib/accountancy/pdf/server';
import {PDF_BUCKET,MAX_PDF_BYTES,suggestPurchase} from '../../../../../../lib/accountancy/pdf/model';
import {extractPurchasePdf} from '../../../../../../lib/accountancy/pdf/extract';
import {scanStagingPdfWithCloudmersive} from '../../../../../../lib/property-operations/scanner/cloudmersive-advanced';
import {uuid} from '../../../../../../lib/accountancy/administration';
export const runtime='nodejs';export const maxDuration=60;
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 const {db,user}=await requirePdfAdmin();
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);
 if(!pdfProcessingReady())return reply({error:'PDF processing is not configured'},503);
 if(!req.headers.get('content-type')?.startsWith('application/pdf'))return reply({error:'PDF required'},415);
 const yearId=new URL(req.url).searchParams.get('year')??'';if(!uuid.test(yearId))return reply({error:'Invalid year'},400);
 const {data:year,error:yearError}=await db.from('mzs_accountancy_years').select('issuer_id').eq('id',yearId).single();if(yearError||!year)return reply({error:'Year unavailable'},404);
 const reader=req.body?.getReader();if(!reader)return reply({error:'PDF required'},400);
 const parts:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PDF_BYTES){await reader.cancel();return reply({error:'PDF exceeds 4 MB'},413);}parts.push(value);}}catch{return reply({error:'Upload interrupted'},400);}
 const bytes=Buffer.concat(parts);if(bytes.length<128||bytes.subarray(0,5).toString()!=='%PDF-')return reply({error:'Invalid PDF'},400);
 let name='invoice.pdf';try{name=decodeURIComponent(req.headers.get('x-pdf-name')??'invoice.pdf').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,160)||name;}catch{}
 const sha=createHash('sha256').update(bytes).digest('hex'),service=processingClient();
 let prior=await service.from('mzs_purchase_pdf_intakes').select('*').eq('issuer_id',year.issuer_id).eq('sha256',sha).maybeSingle();if(prior.error)return reply({error:'Register unavailable'},503);
 let intake=prior.data;
 if(intake&&intake.year_id!==yearId)return reply({error:'This PDF already exists in another year for this entity'},409);
 if(!intake){const id=randomUUID();const inserted=await service.from('mzs_purchase_pdf_intakes').insert({id,year_id:yearId,issuer_id:year.issuer_id,original_name:name,file_path:`${year.issuer_id}/${id}.pdf`,sha256:sha,file_size:size,uploaded_by:user.id}).select('*').single();if(inserted.error){if(inserted.error.code==='23505')return reply({error:'This PDF was already uploaded. Refresh the register.'},409);return reply({error:'Could not retain intake'},503);}intake=inserted.data;}
 const existing=await service.from('mzs_purchase_pdf_results').select('id').eq('intake_id',intake.id).maybeSingle();if(existing.error)return reply({error:'Register unavailable'},503);if(existing.data)return reply({id:intake.id,duplicate:true});
 const uploaded=await service.storage.from(PDF_BUCKET).upload(intake.file_path,bytes,{contentType:'application/pdf',upsert:false});
 if(uploaded.error){const old=await service.storage.from(PDF_BUCKET).download(intake.file_path);if(old.error||!old.data||old.data.size!==size||createHash('sha256').update(Buffer.from(await old.data.arrayBuffer())).digest('hex')!==sha)return reply({id:intake.id,error:'Original upload incomplete. Retry the same PDF.'},503);}
 const scan=await scanStagingPdfWithCloudmersive(bytes,scannerOptions());
 if(scan.reason==='network_error'||scan.reason==='disabled'||scan.reason==='invalid_response')return reply({id:intake.id,error:'Scan unavailable. Original remains quarantined; retry the same PDF.'},503);
 let pages:Awaited<ReturnType<typeof extractPurchasePdf>>=[],extraction='blocked',proposal={};
 if(scan.verdict==='clean'){try{pages=await extractPurchasePdf(bytes);}catch{}extraction=pages.some(p=>p.text.trim().length>=20)?'text':'manual';proposal=suggestPurchase(pages);}
 const result=await service.from('mzs_purchase_pdf_results').insert({intake_id:intake.id,sha256:sha,verdict:scan.verdict,scanner:'Cloudmersive Advanced Virus Scan v1',extraction,pages,proposal});
 if(result.error&&result.error.code!=='23505')return reply({id:intake.id,error:'Could not retain scan result; retry the same PDF.'},503);
 return reply({id:intake.id});
}
