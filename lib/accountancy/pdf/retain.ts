import {createHash,randomUUID} from 'node:crypto';
import {PDF_BUCKET,MAX_PDF_BYTES,suggestPurchase} from './model';
type Input={bytes:Buffer;name:string;yearId:string;issuerId:string;userId:string};
type Dependencies={service:any;scan:(bytes:Buffer)=>Promise<{verdict:string;reason:string}>;extract:(bytes:Buffer)=>Promise<{page:number;text:string}[]>};
export async function retainPurchasePdf(input:Input,deps:Dependencies){
 const {bytes,yearId,issuerId,userId}=input,{service,scan,extract}=deps;
 const reply=(body:Record<string,any>,status=200)=>({body,status});
 const size=bytes.length;
 if(size>MAX_PDF_BYTES)return reply({error:'PDF exceeds 4 MB'},413);
 if(size<128||bytes.subarray(0,5).toString()!=='%PDF-')return reply({error:'Invalid PDF'},400);
 const name=input.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,160)||'invoice.pdf';
 const sha=createHash('sha256').update(bytes).digest('hex');
 const prior=await service.from('mzs_purchase_pdf_intakes').select('*').eq('issuer_id',issuerId).eq('sha256',sha).maybeSingle();
 if(prior.error)return reply({error:'Register unavailable'},503);
 let intake=prior.data;
 if(intake&&intake.year_id!==yearId)return reply({error:'This PDF already exists in another year for this entity'},409);
 if(!intake){
  const id=randomUUID();
  const inserted=await service.from('mzs_purchase_pdf_intakes').insert({id,year_id:yearId,issuer_id:issuerId,original_name:name,file_path:issuerId+'/'+id+'.pdf',sha256:sha,file_size:size,uploaded_by:userId}).select('*').single();
  if(inserted.error)return reply({error:inserted.error.code==='23505'?'This PDF was already uploaded. Refresh the register.':'Could not retain intake'},inserted.error.code==='23505'?409:503);
  intake=inserted.data;
 }
 const existing=await service.from('mzs_purchase_pdf_results').select('id,sha256,verdict').eq('intake_id',intake.id).maybeSingle();
 if(existing.error)return reply({error:'Register unavailable'},503);
 if(existing.data){
  const old=await service.storage.from(PDF_BUCKET).download(intake.file_path);
  if(existing.data.sha256!==sha||old.error||!old.data||old.data.size!==size||createHash('sha256').update(Buffer.from(await old.data.arrayBuffer())).digest('hex')!==sha)return reply({id:intake.id,error:'Retained source could not be verified'},503);
  return reply({id:intake.id,duplicate:true,verdict:existing.data.verdict});
 }
 const uploaded=await service.storage.from(PDF_BUCKET).upload(intake.file_path,bytes,{contentType:'application/pdf',upsert:false});
 if(uploaded.error){
  const old=await service.storage.from(PDF_BUCKET).download(intake.file_path);
  if(old.error||!old.data||old.data.size!==size||createHash('sha256').update(Buffer.from(await old.data.arrayBuffer())).digest('hex')!==sha)return reply({id:intake.id,error:'Original upload incomplete. Retry the same PDF.'},503);
 }
 const scanned=await scan(bytes);
 if(['network_error','disabled','invalid_response'].includes(scanned.reason))return reply({id:intake.id,error:'Scan unavailable. Original remains quarantined; retry the same PDF.'},503);
 let pages:{page:number;text:string}[]=[],extraction='blocked',proposal={};
 if(scanned.verdict==='clean'){try{pages=await extract(bytes);}catch{}extraction=pages.some(p=>p.text.trim().length>=20)?'text':'manual';proposal=suggestPurchase(pages);}
 const result=await service.from('mzs_purchase_pdf_results').insert({intake_id:intake.id,sha256:sha,verdict:scanned.verdict,scanner:'Cloudmersive Advanced Virus Scan v1',extraction,pages,proposal});
 if(result.error)return reply({id:intake.id,error:'Could not retain scan result; retry the same PDF.'},503);
 return reply({id:intake.id,verdict:scanned.verdict});
}
