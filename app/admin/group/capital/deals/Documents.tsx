'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

import ArrowUpRightIcon from "../../../../components/ArrowUpRightIcon";
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '../../../../../lib/supabase/client';
import {type LoanDocument,date,label} from './model';
import s from './deals.module.css';
const BUCKET='mzs-private-capital-documents';
export default function Documents({dealId,documents}:{dealId:string;documents:LoanDocument[]}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const router=useRouter();
 async function upload(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();if(busy)return;const form=e.currentTarget;const f=new FormData(form);const file=f.get('file');
  if(!(file instanceof File)||file.type!=='application/pdf'||file.size<1||file.size>20*1024*1024){setNotice('Choose a PDF up to 20 MiB.');return;}
  const magic=await file.slice(0,5).text();if(magic!=='%PDF-'){setNotice('The file does not appear to be a PDF.');return;}
  setBusy(true);setNotice('');const db=createClient();const path=dealId+'/'+crypto.randomUUID()+'.pdf';let uploaded=false;
  try {
   const {error}=await db.storage.from(BUCKET).upload(path,file,{contentType:'application/pdf',cacheControl:'0',upsert:false});if(error)throw error;uploaded=true;
   const {error:metaError}=await db.from('mzs_capital_documents').insert({deal_id:dealId,file_path:path,file_size:file.size,
    title:String(f.get('title')||'').trim(),category:f.get('category'),version_label:String(f.get('version')||'').trim(),document_status:f.get('status')});
   if(metaError)throw metaError;uploaded=false;form.reset();setNotice('Private document attached. Access remains limited to full administrators.');router.refresh();
  }catch{if(uploaded)await db.storage.from(BUCKET).remove([path]);setNotice('Upload could not be completed. No document was published.');}
  finally{setBusy(false);}
 }
 return <>{documents.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Document")}</th><th>{adminT("Version / status")}</th><th>{adminT("Added")}</th></tr></thead><tbody>{documents.map(d=><tr key={d.id}><td><a href={'/admin/group/capital/deals/documents/'+d.id} target="_blank" rel="noopener noreferrer">{d.title} <ArrowUpRightIcon /></a><small>{adminT(label(d.category))}</small></td><td>{d.version_label}<small>{adminT(label(d.document_status))}</small></td><td>{date(d.created_at, adminLocale)}</td></tr>)}</tbody></table></div>:<p className={s.empty}>{adminT("No PDFs attached yet. Source references in the deal are not downloadable documents.")}</p>}
  <details><summary>{adminT("Attach an agreement, payment schedule or supporting PDF")}</summary>
   <form className={s.form} onSubmit={upload}>
    <label>{adminT("Document title")}<input name="title" required minLength={2} maxLength={160}/></label>
    <label>{adminT("Category")}<select name="category"><option value="agreement">{adminT("Agreement")}</option><option value="schedule">{adminT("Payment schedule")}</option><option value="other">{adminT("Supporting document")}</option></select></label>
    <label>{adminT("Version label")}<input name="version" required maxLength={40} defaultValue="1"/></label>
    <label>{adminT("Document status")}<select name="status"><option value="draft">{adminT("Draft")}</option><option value="signed">{adminT("Signed (manually verified)")}</option><option value="reference">{adminT("Reference")}</option></select></label>
    <label className={s.wide}>{adminT("Private PDF (up to 20 MiB)")}<input type="file" name="file" accept="application/pdf" required/></label>
    <p className={s.wide}>{adminT("Each upload is a new retained version. “Signed” is an administrator’s classification, not an electronic signature or automated verification.")}</p>
    <button disabled={busy}>{busy?adminT("Uploading…"):adminT("Attach privately")}</button>
   </form>
  </details>{notice&&<p role="status" className={s.notice}>{adminT(notice)}</p>}
 </>;
}
