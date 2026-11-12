import {createHash,randomUUID} from 'node:crypto';
export const RECEIPTS='mzs_mailbox_receipts';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function recordReceipt(service,{uid,uidValidity,source,files,intakes,issuerId,yearId,userId}){
 if(!files.length||files.length!==intakes.length)throw Error('incomplete_receipt');
 const identity={mailbox:'mase@mzsgroup.eu',folder:'INBOX',uid_validity:uidValidity,uid};
 const attachments=files.map((f,n)=>({id:intakes[n].id,sha256:sha256(f.bytes)}));
 const row={...identity,issuer_id:issuerId,year_id:yearId,source_sha256:sha256(source),attachments,created_by:userId};
 const inserted=await service.from(RECEIPTS).insert(row).select('id,state').single();
 if(!inserted.error)return inserted.data;
 if(inserted.error.code!=='23505')throw Error('receipt_unavailable');
 let query=service.from(RECEIPTS).select('*');
 for(const [key,value] of Object.entries(identity))query=query.eq(key,value);
 const prior=await query.single();
 if(prior.error||!prior.data||prior.data.issuer_id!==issuerId||prior.data.year_id!==yearId||
    prior.data.source_sha256!==row.source_sha256||JSON.stringify(prior.data.attachments.map(a=>({id:a.id,sha256:a.sha256})))!==JSON.stringify(attachments))
  throw Error('receipt_conflict');
 return {id:prior.data.id,state:prior.data.state};
}
export async function verifyReceiptOriginals(service,receipt){
 for(const a of receipt.attachments){
  const {data:i,error}=await service.from('mzs_purchase_pdf_intakes').select('*').eq('id',a.id).single();
  if(error||!i||i.issuer_id!==receipt.issuer_id||i.year_id!==receipt.year_id||i.sha256!==a.sha256)throw Error('source_scope');
  const {data:r,error:re}=await service.from('mzs_purchase_pdf_results').select('id,sha256,verdict').eq('intake_id',i.id).single();
  const {data:d,error:de}=await service.from('mzs_purchase_pdf_decisions').select('action,draft_id,result_id').eq('intake_id',i.id).single();
  if(re||de||!r||r.verdict!=='clean'||r.sha256!==a.sha256||!d||d.action!=='accepted'||!d.draft_id||d.result_id!==r.id)throw Error('review_required');
  const stored=await service.storage.from('mzs-purchase-pdf-quarantine').download(i.file_path);
  if(stored.error||!stored.data||stored.data.size!==i.file_size||sha256(Buffer.from(await stored.data.arrayBuffer()))!==a.sha256)throw Error('original_unavailable');
 }
}
export async function claimMove(service,receipt){
 const token=randomUUID();
 const {data,error}=await service.from(RECEIPTS).update({state:'moving',move_token:token}).eq('id',receipt.id).eq('state','review').select('id').maybeSingle();
 if(error||!data)throw Error('move_not_claimed');
 return token;
}
export async function finishMove(service,id,token,state,destination={}){
 const {data,error}=await service.from(RECEIPTS).update({state,move_token:state==='review'?null:token,...destination}).eq('id',id).eq('state','moving').eq('move_token',token).select('id').maybeSingle();
 if(error||!data)throw Error('move_result_not_recorded');
}
