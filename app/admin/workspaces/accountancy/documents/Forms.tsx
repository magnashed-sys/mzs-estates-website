'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '../../../../../lib/supabase/client';
import {ARCHIVE_BUCKET,ARCHIVE_ROOT,MAX_PDF_BYTES,categories,categoryLabels,copy,documentPath,statuses,statusLabels,validatePdf,type ArchiveDocument,type Entity,type Language} from '../../../../../lib/accountancy/archive';
import {registerDocument,updateDocument} from './actions';
import s from './archive.module.css';
function Fields({language,document}:{language:Language;document?:ArchiveDocument}){
 const t=copy[language];
 return <><label>{t.documentTitle}<input name="title" required minLength={2} maxLength={160} defaultValue={document?.title}/></label>
 <label>{t.category}<select name="category" defaultValue={document?.category??'other'}>{categories.map(c=><option key={c} value={c}>{categoryLabels[language][c]}</option>)}</select></label>
 <label>{t.period}<input name="period_label" maxLength={40} defaultValue={document?.period_label}/></label>
 <label>{t.date}<input type="date" name="document_date" defaultValue={document?.document_date??''}/></label>
 <label>{t.status}<select name="review_status" defaultValue={document?.review_status??'pending_review'}>{statuses.map(c=><option key={c} value={c}>{statusLabels[language][c]}</option>)}</select></label>
 <label className={s.wide}>{t.notes}<textarea name="notes" maxLength={4000} rows={4} defaultValue={document?.notes}/></label></>;
}
const message=(language:Language,code?:string)=>{const t=copy[language];return code==='duplicate'?t.duplicate:code==='invalid'?t.invalid:code==='invalid_pdf'?t.invalid_pdf:code==='stale'?t.stale:t.failed;};
export function UploadForm({entities,language,entity,year,fixedContext=false}:{entities:Entity[];language:Language;entity:string;year:number;fixedContext?:boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[ok,setOk]=useState(false);const lock=useRef(false);const router=useRouter();const t=copy[language];
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setNotice('');setOk(false);
  const form=e.currentTarget,f=new FormData(form),file=f.get('file');let path:string|undefined,uploaded=false;const db=createClient();
  try{
   if(!(file instanceof File)||file.size<5||file.size>MAX_PDF_BYTES||!file.name.toLowerCase().endsWith('.pdf'))throw Error('invalid_pdf');
   validatePdf(new Uint8Array(await file.arrayBuffer()));
   const id=crypto.randomUUID();path=documentPath(String(f.get('issuer_id')),Number(f.get('fiscal_year')),id);
   const {error}=await db.storage.from(ARCHIVE_BUCKET).upload(path,file,{contentType:'application/pdf',cacheControl:'0',upsert:false});
   if(error)throw Error('failed');uploaded=true;f.delete('file');f.set('id',id);f.set('original_name',file.name);
   const result=await registerDocument(f);if(!result.ok)throw Error(result.code);
   uploaded=false;setOk(true);setNotice(t.saved);form.reset();router.refresh();
  }catch(error){
   // RLS forbids deleting an object once registered, including ambiguous network failures.
   if(uploaded&&path)await db.storage.from(ARCHIVE_BUCKET).remove([path]).catch(()=>undefined);
   setNotice(message(language,error instanceof Error?error.message:undefined));
  }finally{lock.current=false;setBusy(false);}
 }
 return <details className={s.panel}><summary>{t.upload}</summary><form onSubmit={submit}><fieldset disabled={busy} className={s.form}>
  <label>{t.entity}<select name="issuer_id" required disabled={fixedContext} defaultValue={entities.some(e=>e.id===entity)?entity:''}><option value="" disabled>{t.entity}</option>{entities.map(e=><option key={e.id} value={e.id}>{e.name}{e.tax_id?' · '+e.tax_id:''}</option>)}</select></label>
  {fixedContext&&<input type="hidden" name="issuer_id" value={entity}/>}<label>{t.year}<input readOnly={fixedContext} name="fiscal_year" type="number" min={1900} max={2199} step={1} required defaultValue={year}/></label>
  <Fields language={language}/><label className={s.wide}>{t.file}<input name="file" type="file" accept="application/pdf,.pdf" required/></label>
  <p className={s.wide}>{t.retained}</p><button className={s.button} disabled={!entities.length}>{busy?t.saving:t.submit}</button>
 </fieldset></form>{notice&&<p role={ok?'status':'alert'}>{notice}</p>}</details>;
}
export function ReviewForm({document,language}:{document:ArchiveDocument;language:Language}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[ok,setOk]=useState(false);const lock=useRef(false);const router=useRouter();const t=copy[language];
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setNotice('');setOk(false);
  try{const result=await updateDocument(new FormData(e.currentTarget));if(!result.ok)throw Error(result.code);setOk(true);setNotice(t.saved);router.refresh();}
  catch(error){setNotice(message(language,error instanceof Error?error.message:undefined));}
  finally{lock.current=false;setBusy(false);}
 }
 return <form onSubmit={submit} className={s.panel}><input type="hidden" name="id" value={document.id}/><input type="hidden" name="revision" value={document.revision}/>
  <fieldset disabled={busy} className={s.form}><Fields language={language} document={document}/><p className={s.wide}>{t.reviewHelp}</p><button className={s.button}>{busy?t.saving:t.edit}</button></fieldset>
  {notice&&<p role={ok?'status':'alert'}>{notice}</p>}
 </form>;
}
