'use server';
import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {ARCHIVE_BUCKET,ARCHIVE_ROOT,MAX_PDF_BYTES,archiveFields,documentPath,uuid,validatePdf} from '../../../../../lib/accountancy/archive';
export async function registerDocument(form:FormData):Promise<{ok:boolean;code?:string;id?:string}>{
 const {db}=await requireEstateAdmin();
 let fields,id,entity,year,path,name;
 try{
  fields=archiveFields(form);id=String(form.get('id'));entity=String(form.get('issuer_id'));year=Number(form.get('fiscal_year'));
  path=documentPath(entity,year,id);name=String(form.get('original_name'));
  if(!name||name.length>255||/[\r\n/\u0000]/.test(name))throw Error('invalid');
 }catch{return {ok:false,code:'invalid'};}
 // The server verifies the actual stored bytes; never trust a browser-supplied fingerprint.
 const {data:blob,error:downloadError}=await db.storage.from(ARCHIVE_BUCKET).download(path);
 if(downloadError||!blob)return {ok:false,code:'failed'};
 if(blob.size>MAX_PDF_BYTES)return {ok:false,code:'invalid_pdf'};
 const bytes=new Uint8Array(await blob.arrayBuffer());
 try{validatePdf(bytes);}catch{return {ok:false,code:'invalid_pdf'};}
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const {error}=await db.from('mzs_accountancy_documents').insert({...fields,id,issuer_id:entity,fiscal_year:year,original_name:name,file_path:path,file_size_bytes:bytes.length,sha256});
 if(error){
  // A retry after a lost response must not report an already successful archive as failure.
  const prior=await db.from('mzs_accountancy_documents').select('id,sha256').eq('id',id).maybeSingle();
  if(!prior.error&&prior.data?.sha256===sha256){revalidatePath(ARCHIVE_ROOT);return {ok:true,id};}
  return {ok:false,code:error.code==='23505'?'duplicate':'failed'};
 }
 revalidatePath(ARCHIVE_ROOT);return {ok:true,id};
}
export async function updateDocument(form:FormData):Promise<{ok:boolean;code?:string}>{
 const {db}=await requireEstateAdmin();let fields;
 const id=String(form.get('id')),revision=Number(form.get('revision'));
 try{fields=archiveFields(form);if(!uuid.test(id)||!Number.isSafeInteger(revision)||revision<1)throw Error('invalid');}catch{return {ok:false,code:'invalid'};}
 const {data,error}=await db.from('mzs_accountancy_documents').update(fields).eq('id',id).eq('revision',revision).select('id').maybeSingle();
 if(error)return {ok:false,code:'failed'};if(!data)return {ok:false,code:'stale'};
 revalidatePath(ARCHIVE_ROOT);revalidatePath(ARCHIVE_ROOT+'/'+id);return {ok:true};
}
export async function setArchiveLanguage(form:FormData){
 const {db,user}=await requireEstateAdmin();const language=String(form.get('language'));
 if(!['en','es'].includes(language))return;
 const {error}=await db.from('mzs_admin_language_preferences').upsert({user_id:user.id,language});
 if(error)throw Error('Language preference could not be saved');revalidatePath('/admin','layout');
}
