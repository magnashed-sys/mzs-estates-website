import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {revalidatePath} from 'next/cache';
import {ARCHIVE_BUCKET,documentPath} from '../../../../lib/accountancy/archive';
import {bridgeHeaders,boundedPdf,isAssistantBridgeStaging} from '../../../../lib/accountancy/assistant-bridge';
import {scannerOptions} from '../../../../lib/accountancy/pdf/server';
import {scannerIsExplicitlyEnabled,scanStagingPdfWithCloudmersive} from '../../../../lib/property-operations/scanner/cloudmersive-advanced';

/**
 * Disabled-by-default STAGING service-to-service intake of already registered purchase concepts.
 * Caller must present a real, verified Supabase Auth admin JWT, never the publishable API key.
 * Only accepts raw PDF bytes and an existing immutable draft ID. No URLs, bank data or payments.
 * ChatGPT conversation files cannot be fetched from the server; an authorized client must send bytes.
 */
export const runtime='nodejs';
export const maxDuration=60;
const reply=(body:object,status=200)=>Response.json(body,{
 status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
});
type Stored={id:string;file_path:string;sha256:string;file_size_bytes:number;review_status:string};
export async function POST(req:Request):Promise<Response>{
 if(!isAssistantBridgeStaging())return reply({error:'not_found'},404);
 // A customer-hosted endpoint is not usable until the approved scanner/region/privacy gates are active.
 if(!scannerIsExplicitlyEnabled(scannerOptions()))
  return reply({error:'scanner_not_approved'},503);
 if(req.headers.has('origin'))return reply({error:'cross_origin_request'},403);
 let input:ReturnType<typeof bridgeHeaders>;
 try{input=bridgeHeaders(req.headers);}
 catch(e){return reply({error:e instanceof Error&&e.message==='unauthenticated'?'unauthenticated':'invalid_headers'},
  e instanceof Error&&e.message==='unauthenticated'?401:400);}
 const db=createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {accessToken:async()=>input.token,auth:{persistSession:false,autoRefreshToken:false}}
 );
 // Network-backed getUser verifies the JWT. Never trust a decoded JWT claim alone.
 const auth=await db.auth.getUser(input.token);
 if(auth.error||!auth.data.user)return reply({error:'unauthenticated'},401);
 const profile=await db.from('profiles').select('role,is_active').eq('id',auth.data.user.id).single();
 if(profile.error||profile.data?.role!=='admin'||profile.data.is_active!==true)
  return reply({error:'forbidden'},403);
 const draft=await db.from('mzs_ops_expense_drafts')
  .select('id,legal_entity_id,invoice_date,supplier_invoice_number,status')
  .eq('id',input.draftId).maybeSingle();
 if(draft.error)return reply({error:'draft_unavailable'},503);
 if(!draft.data||draft.data.status!=='draft')return reply({error:'draft_not_found'},404);
 const entity=draft.data.legal_entity_id,year=Number(draft.data.invoice_date?.slice(0,4));
 if(!entity||!Number.isInteger(year)||year<1900||year>2199)
  return reply({error:'draft_unavailable'},503);
 let bytes:Uint8Array;
 try{bytes=await boundedPdf(req);}
 catch(e){
  const reason=e instanceof Error?e.message:'invalid_pdf';
  return reply({error:reason},reason==='too_large'?413:reason==='pdf_required'?415:400);
 }
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==input.sha256)return reply({error:'checksum_mismatch'},422);
 // Must verify the server-side scanner verdict; no client-supplied "clean" assertions.
 const scan=await scanStagingPdfWithCloudmersive(bytes,scannerOptions());
 if(scan.verdict!=='clean')return reply({error:scan.reason==='threat'?'malicious_pdf':'scan_unavailable'},
  scan.reason==='threat'?422:503);
 const docs=()=>db.from('mzs_accountancy_documents');
 let existing=await docs().select('id,file_path,sha256,file_size_bytes,review_status')
  .eq('issuer_id',entity).eq('fiscal_year',year).eq('sha256',sha256).maybeSingle();
 if(existing.error)return reply({error:'archive_unavailable'},503);
 let document:Stored|undefined=existing.data||undefined;
 if(document?.review_status==='superseded')
  return reply({error:'original_superseded'},409);
 let isNew=false;
 if(!document){
  const id=randomUUID(),file_path=documentPath(entity,year,id);
  const upload=await db.storage.from(ARCHIVE_BUCKET).upload(file_path,bytes,{
   contentType:'application/pdf',cacheControl:'0',upsert:false
  });
  if(upload.error)return reply({error:'upload_failed'},503);
  // Verify the real retained bytes before registering a checksum or an invoice association.
  const original=await db.storage.from(ARCHIVE_BUCKET).download(file_path);
  if(original.error||!original.data)return reply({error:'original_not_verified',document_id:id},503);
  const stored=new Uint8Array(await original.data.arrayBuffer());
  if(stored.length!==bytes.length||createHash('sha256').update(stored).digest('hex')!==sha256)
   return reply({error:'original_not_verified',document_id:id},503);
  const result=await docs().insert({
   id,issuer_id:entity,fiscal_year:year,
   title:('Supplier invoice '+draft.data.supplier_invoice_number).slice(0,160),
   original_name:input.filename,category:'supplier_invoice',
   period_label:'',document_date:draft.data.invoice_date,
   review_status:'pending_review',
   notes:'Authenticated staging assistant transfer; clean scanner verdict. Requires invoice and tax review. No payment or tax deduction was recorded.',
   file_path,file_size_bytes:stored.length,mime_type:'application/pdf',sha256
  }).select('id,file_path,sha256,file_size_bytes,review_status').single();
  if(result.error||!result.data){
   // An ambiguous database acknowledgement cannot justify deleting an uploaded original.
   return reply({error:'archive_registration_unconfirmed',document_id:id,sha256},503);
  }
  document=result.data;isNew=true;
 }
 // Even reused/duplicate references must verify real private original bytes, not metadata alone.
 const original=await db.storage.from(ARCHIVE_BUCKET).download(document.file_path);
 if(original.error||!original.data)return reply({error:'original_not_verified',document_id:document.id},503);
 const stored=new Uint8Array(await original.data.arrayBuffer());
 if(stored.length!==document.file_size_bytes||createHash('sha256').update(stored).digest('hex')!==sha256)
  return reply({error:'original_not_verified',document_id:document.id},503);
 const linked=await db.from('mzs_accountancy_document_links')
  .insert({document_id:document.id,draft_id:input.draftId});
 if(linked.error&&linked.error.code!=='23505')
  return reply({status:'archived_link_unconfirmed',document_id:document.id,sha256,linked:false},202);
 const check=await db.from('mzs_accountancy_document_links')
  .select('id,is_active').eq('document_id',document.id)
  .eq('draft_id',input.draftId).eq('is_active',true).maybeSingle();
 if(check.error||!check.data)
  return reply({status:'archived_link_unconfirmed',document_id:document.id,sha256,linked:false},202);
 revalidatePath('/admin','layout');
 return reply({status:'archived_and_linked',document_id:document.id,
  draft_id:input.draftId,sha256,archive_verified:true,linked:true,
  review_status:document.review_status,payment_recorded:false},isNew?201:200);
}
