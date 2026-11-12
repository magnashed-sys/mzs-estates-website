import {retainPurchasePdf} from '../../../../../../lib/accountancy/pdf/retain';
import {NextResponse} from 'next/server';
import {requirePdfAdmin,pdfProcessingReady,processingClient,scannerOptions} from '../../../../../../lib/accountancy/pdf/server';
import {MAX_PDF_BYTES} from '../../../../../../lib/accountancy/pdf/model';
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
 const result=await retainPurchasePdf({bytes,name,yearId,issuerId:year.issuer_id,userId:user.id},{service:processingClient(),scan:bytes=>scanStagingPdfWithCloudmersive(bytes,scannerOptions()),extract:extractPurchasePdf});
 return reply(result.body,result.status);
}
