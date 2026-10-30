import type {SupabaseClient} from '@supabase/supabase-js';
import {ARCHIVE_BUCKET,MAX_PDF_BYTES,uuid} from './archive';
import type {YearSource} from './administration';
import {exportHash,type ArchiveFile} from '../property-operations/accountant-archive';

export const MAX_YEAR_PDF_BYTES=64*1024*1024;
export const MAX_YEAR_PDFS=500;
export type YearOriginal=ArchiveFile&{documentId:string};
export class YearOriginalError extends Error{
 constructor(public readonly code:'limit'|'changed'|'unavailable',public readonly documentId?:string){super(code);}
}
export function originalArchivePath(id:string):string{
 if(!uuid.test(id))throw new YearOriginalError('changed');
 return 'documents/'+id+'.pdf';
}

/** The caller's admin session and storage RLS are used, never a service key.
 * Fetch only snapshot IDs, recheck immutable identity and review metadata, then
 * validate the actual private bytes before any ZIP response can begin. */
export async function loadYearOriginals(db:SupabaseClient,source:YearSource,signal?:AbortSignal):Promise<YearOriginal[]>{
 const {issuer_id,fiscal_year}=source.administration,documents=source.documents;
 if(documents.length>MAX_YEAR_PDFS)throw new YearOriginalError('limit');
 const ids=new Set<string>();
 for(const d of documents){
  if(!uuid.test(d.id)||ids.has(d.id)||d.issuer_id!==issuer_id||d.fiscal_year!==fiscal_year||!/^[a-f0-9]{64}$/.test(d.sha256))throw new YearOriginalError('changed');
  ids.add(d.id);
 }
 const metadata=new Map<string,{id:string;file_path:string;file_size_bytes:number;sha256:string}>();
 let total=0;
 for(let offset=0;offset<documents.length;offset+=100){
  signal?.throwIfAborted();
  const batch=documents.slice(offset,offset+100);
  const {data,error}=await db.from('mzs_accountancy_documents')
   .select('id,issuer_id,fiscal_year,title,original_name,category,review_status,sha256,notes,updated_at,file_path,file_size_bytes,mime_type')
   .eq('issuer_id',issuer_id).eq('fiscal_year',fiscal_year).in('id',batch.map(d=>d.id));
  if(error||!data)throw new YearOriginalError('unavailable');
  if(data.length!==batch.length)throw new YearOriginalError('changed');
  for(const row of data){
   const d=batch.find(d=>d.id===row.id);
   if(!d||metadata.has(row.id)||['id','issuer_id','fiscal_year','title','original_name','category','review_status','sha256','notes'].some(k=>row[k as keyof typeof row]!==d[k])||
    !Number.isFinite(Date.parse(d.updated_at))||Date.parse(row.updated_at)!==Date.parse(d.updated_at)||
    row.file_path!==`${issuer_id}/${fiscal_year}/${d.id}.pdf`||row.mime_type!=='application/pdf'||
    !Number.isSafeInteger(row.file_size_bytes)||row.file_size_bytes<5||row.file_size_bytes>MAX_PDF_BYTES)
    throw new YearOriginalError('changed',d?.id);
   total+=row.file_size_bytes;
   if(total>MAX_YEAR_PDF_BYTES)throw new YearOriginalError('limit');
   metadata.set(row.id,row);
  }
 }
 const originals:YearOriginal[]=[];
 // Four bounded downloads at a time; preserve snapshot order in the archive.
 for(let offset=0;offset<documents.length;offset+=4){
  signal?.throwIfAborted();
  const batch=await Promise.all(documents.slice(offset,offset+4).map(async d=>{
   const row=metadata.get(d.id)!;
   const {data,error}=await db.storage.from(ARCHIVE_BUCKET).download(row.file_path,{}, {signal,cache:'no-store'});
   if(error||!data)throw new YearOriginalError('unavailable',d.id);
   if(data.size!==row.file_size_bytes)throw new YearOriginalError('changed',d.id);
   const bytes=new Uint8Array(await data.arrayBuffer());
   if(Buffer.from(bytes.subarray(0,5)).toString('ascii')!=='%PDF-'||exportHash(bytes)!==row.sha256)throw new YearOriginalError('changed',d.id);
   return {documentId:d.id,name:originalArchivePath(d.id),bytes};
  }));
  originals.push(...batch);
 }
 return originals;
}

/** Keeps the manifest/index and the actual archive inseparable, including callers
 * other than the route. UUID paths avoid duplicate/unsafe original filenames. */
export function validateYearOriginals(source:YearSource,originals:readonly YearOriginal[]):void{
 if(originals.length!==source.documents.length)throw new YearOriginalError('changed');
 const seen=new Set<string>();
 for(const file of originals){
  const d=source.documents.find(d=>d.id===file.documentId);
  if(!d||seen.has(d.id)||file.name!==originalArchivePath(d.id)||exportHash(file.bytes)!==d.sha256)
   throw new YearOriginalError('changed');
  seen.add(d.id);
 }
}
