'use client';
import {useState,useRef,type ChangeEvent} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '../../../../../lib/supabase/client';
import {ARCHIVE_BUCKET,MAX_PDF_BYTES,documentPath,validatePdf,type Entity,type Language} from '../../../../../lib/accountancy/archive';
import {classifyPrivateAccountancyPdf} from '../../../../../lib/accountancy/batch-classifier';
import {registerDocument} from './actions';
import s from './archive.module.css';
type ItemStatus={name:string;state:'saved'|'duplicate'|'failed';message:string};
export function BulkArchiveUpload({entities,language,entity,year}:{entities:Entity[];language:Language;entity:string;year:number}){
 const [chosen,setChosen]=useState(entities.some(e=>e.id===entity)?entity:'');
 const [files,setFiles]=useState<File[]>([]);
 const [outcomes,setOutcomes]=useState<ItemStatus[]>([]);
 const [busy,setBusy]=useState(false);
 const router=useRouter(),lock=useRef(false);
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const change=(event:ChangeEvent<HTMLInputElement>)=>{
  const values=Array.from(event.target.files??[]);
  setFiles(values);setOutcomes([]);
 };
 async function uploadAll(){
  if(lock.current||!chosen||!entities.some(x=>x.id===chosen)||files.length<1||files.length>25)return;
  lock.current=true;setBusy(true);setOutcomes([]);
  const db=createClient(),seen=new Set<string>();let done=0;
  const results:ItemStatus[]=[];
  try{
   for(const file of files){
    let path:string|undefined,uploaded=false,registrationConfirmed=false;
    try{
     if(!file.name.toLowerCase().endsWith('.pdf')||file.size<5||file.size>MAX_PDF_BYTES)throw Error('invalid_pdf');
     const metadata=classifyPrivateAccountancyPdf(file.name,year);
     const bytes=new Uint8Array(await file.arrayBuffer());validatePdf(bytes);
     const digestBytes=await crypto.subtle.digest('SHA-256',bytes);
     const sha=Array.from(new Uint8Array(digestBytes)).map(b=>b.toString(16).padStart(2,'0')).join('');
     const uniqueKey=chosen+':'+metadata.fiscal_year+':'+sha;
     if(seen.has(uniqueKey)){results.push({name:file.name,state:'duplicate',message:tr('Repeated in this selection','Repetido en esta selección')});done++;setOutcomes([...results]);continue;}
     seen.add(uniqueKey);
     const id=crypto.randomUUID();path=documentPath(chosen,metadata.fiscal_year,id);
     const storage=await db.storage.from(ARCHIVE_BUCKET).upload(path,bytes,{contentType:'application/pdf',cacheControl:'0',upsert:false});
     if(storage.error)throw Error('storage_failed');uploaded=true;
     const form=new FormData();form.set('id',id);form.set('issuer_id',chosen);form.set('fiscal_year',String(metadata.fiscal_year));
     form.set('original_name',file.name);form.set('title',metadata.title);form.set('category',metadata.category);
     form.set('period_label',metadata.period_label);form.set('document_date',metadata.document_date??'');
     form.set('review_status',metadata.review_status);form.set('notes',metadata.notes);
     const result=await registerDocument(form);
     if(!result.ok)throw Error(result.code??'registration_failed');
     registrationConfirmed=true;
     results.push({name:file.name,state:'saved',message:metadata.fiscal_year+' · '+tr('Original archived, pending review','Original archivado, pendiente de revisión')});
    }catch(error){
     const reason=error instanceof Error?error.message:'unknown';
     // Never delete a successfully registered original. If ambiguous, leave it for an admin to inspect.
     if(uploaded&&path&&!registrationConfirmed){
      await db.storage.from(ARCHIVE_BUCKET).remove([path]).catch(()=>undefined);
     }
     const duplicate=reason==='duplicate';
     results.push({name:file.name,state:duplicate?'duplicate':'failed',message:duplicate?
      tr('Already archived – no duplicate created','Ya archivado – sin duplicado'):
      tr('Not archived. Review and retry this PDF.','No archivado. Revise y vuelva a intentar este PDF.')});
    }
    done++;setOutcomes([...results]);
   }
  }finally{lock.current=false;setBusy(false);router.refresh();}
 }
 const yearCount=files.reduce((acc,f)=>{try{const y=classifyPrivateAccountancyPdf(f.name,year).fiscal_year;acc[y]=(acc[y]??0)+1;}catch{}return acc;},{} as Record<number,number>);
 return <section className={s.panel} aria-label={tr('Bulk private PDF archive','Archivo privado PDF por lotes')}>
  <h2>{tr('Bulk archive · up to 25 original PDFs','Archivo por lotes · hasta 25 PDF originales')}</h2>
  <p>{tr('Select the legal entity and original files. The year and document type are suggested from each filename. Only source PDFs are archived; supplier, VAT, costs and payments are not automatically posted. The archive remains private.', 'Seleccione la entidad jurídica y los archivos originales. El año y el tipo se sugieren a partir del nombre. Solo se archivan los PDF; no se contabilizan automáticamente proveedores, IVA, costes ni pagos. El archivo sigue siendo privado.')}</p>
  <div className={s.form}>
   <label>{tr('Legal entity','Entidad jurídica')}<select value={chosen} disabled={busy} onChange={e=>setChosen(e.target.value)}><option value="">{tr('Select an entity','Seleccione una entidad')}</option>{entities.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label>{tr('Original PDFs (multiple selection)','PDF originales (selección múltiple)')}<input type="file" multiple accept="application/pdf,.pdf" disabled={busy} onChange={change}/></label>
   {files.length>0&&<div className={s.wide}>
    <p>{files.length} {tr('selected','seleccionados')} · {Object.entries(yearCount).map(([y,n])=>y+': '+n).join(' · ')}</p>
    {files.length>25&&<p role="alert">{tr('Maximum 25 files per batch.','Máximo 25 archivos por lote.')}</p>}
    <ul>{files.map((f,i)=><li key={i}>{f.name}</li>)}</ul>
   </div>}
   <button type="button" className={s.button} disabled={busy||!chosen||!files.length||files.length>25} onClick={uploadAll}>
    {busy?tr('Archiving and checking files…','Archivando y comprobando archivos…'):tr('Verify and archive selected originals','Verificar y archivar los originales')}
   </button>
   {outcomes.length>0&&<div className={s.wide} role="status">
    <strong>{outcomes.filter(r=>r.state==='saved').length} {tr('archived','archivados')} · {outcomes.filter(r=>r.state==='duplicate').length} {tr('duplicates','duplicados')} · {outcomes.filter(r=>r.state==='failed').length} {tr('failed','errores')}</strong>
    <ul>{outcomes.map((r,i)=><li key={i}>{r.name}: {r.message}</li>)}</ul>
   </div>}
  </div>
 </section>;
}
