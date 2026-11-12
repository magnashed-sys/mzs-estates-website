import {NextResponse} from 'next/server';
import {requirePdfAdmin,pdfProcessingReady,processingClient} from '../../../../../../lib/accountancy/pdf/server';
import {uuid} from '../../../../../../lib/accountancy/administration';
import {mailboxClient} from '../../../../../../lib/accountancy/mailbox/import.mjs';
import {moveReviewedMessage} from '../../../../../../lib/accountancy/mailbox/move.mjs';
export const runtime='nodejs';
export const maxDuration=120;
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 await requirePdfAdmin();
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);
 // Real source messages must never be moved by a staging deployment.
 if(process.env.VERCEL_ENV!=='production'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ptrnjzmcehrhbsfxntgw.supabase.co'||
    process.env.MZS_MASE_MOVE_ENABLED!=='true'||process.env.MZS_MASE_IMPORT_ENABLED!=='true'||!pdfProcessingReady()||
    !process.env.MZS_MASE_IMAP_PASSWORD)return reply({error:'Verplaatsen is nog niet ingeschakeld.'},503);
 const id=new URL(req.url).searchParams.get('receipt')??'';
 const issuerId=process.env.MZS_MASE_ISSUER_ID??'';
 if(!uuid.test(id)||!uuid.test(issuerId))return reply({error:'Ongeldige selectie.'},400);
 const service=processingClient();
 const {data:receipt,error}=await service.from('mzs_mailbox_receipts').select('*').eq('id',id).eq('issuer_id',issuerId).single();
 if(error||!receipt)return reply({error:'Verwerkingsregistratie niet gevonden.'},404);
 if(receipt.state==='moved')return reply({state:'moved'});
 if(receipt.state!=='review')return reply({error:'Verplaatsing vereist controle; probeer niet automatisch opnieuw.'},409);
 try{
  const result=await moveReviewedMessage({client:mailboxClient(process.env.MZS_MASE_IMAP_PASSWORD),service,receipt});
  return reply(result,result.state==='moved'?200:409);
 }catch{return reply({error:'Controleer of alle bijlagen zijn bevestigd. Bij een onderbreking blijft de registratie bewaard.'},409);}
}
