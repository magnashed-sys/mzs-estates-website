import {NextResponse} from 'next/server';
import {requirePdfAdmin,pdfProcessingReady,processingClient,scannerOptions} from '../../../../../../lib/accountancy/pdf/server';
import {retainPurchasePdf} from '../../../../../../lib/accountancy/pdf/retain';
import {extractPurchasePdf} from '../../../../../../lib/accountancy/pdf/extract';
import {scanStagingPdfWithCloudmersive} from '../../../../../../lib/property-operations/scanner/cloudmersive-advanced';
import {uuid} from '../../../../../../lib/accountancy/administration';
import {mailboxClient,importMailboxBatch} from '../../../../../../lib/accountancy/mailbox/import.mjs';
export const runtime='nodejs';
export const maxDuration=300;
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 const {db,user}=await requirePdfAdmin();
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);
 const issuerId=process.env.MZS_MASE_ISSUER_ID??'';
 if(process.env.MZS_MASE_IMPORT_ENABLED!=='true'||!pdfProcessingReady()||!uuid.test(issuerId)||!process.env.MZS_MASE_IMAP_PASSWORD)return reply({error:'Mailbox import is not configured'},503);
 const params=new URL(req.url).searchParams;
 const afterUid=Number(params.get('after')??'0');
 const expectedValidity=params.get('validity')??'';
 if((afterUid>0&&!expectedValidity)||(expectedValidity&&!/^[1-9][0-9]{0,9}$/.test(expectedValidity)))return reply({error:'Mailbox cursor expired; restart from the first batch'},400);
 if(!Number.isSafeInteger(afterUid)||afterUid<0||afterUid>4294967295)return reply({error:'Invalid cursor'},400);
 const yearId=params.get('year')??'';
 if(!uuid.test(yearId))return reply({error:'Select the financial year'},400);
 const {data:year,error}=await db.from('mzs_accountancy_years').select('id,issuer_id').eq('id',yearId).eq('issuer_id',issuerId).single();
 if(error||!year)return reply({error:'Mase administration unavailable'},404);
 try{
  const service=processingClient();
  const result=await importMailboxBatch({
   client:mailboxClient(process.env.MZS_MASE_IMAP_PASSWORD),afterUid,expectedValidity,
   retain:file=>retainPurchasePdf({bytes:file.bytes,name:file.name,yearId,issuerId,userId:user.id},{service,scan:bytes=>scanStagingPdfWithCloudmersive(bytes,scannerOptions()),extract:extractPurchasePdf})
  });
  return reply({messages:result,moved:0,notice:'Review the retained PDFs before creating expense concepts. Messages remain in INBOX.'});
 }catch{return reply({error:'Mailbox import interrupted. Retained PDFs can be retried safely; messages remain in INBOX.'},503);}
}
