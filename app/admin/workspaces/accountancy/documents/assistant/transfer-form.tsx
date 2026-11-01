'use client';
import {useRef,useState} from 'react';
import {ASSISTANT_MAX_PDF_BYTES} from '../../../../../../lib/accountancy/assistant-bridge';
import type {Language} from '../../../../../../lib/accountancy/archive';
import s from '../archive.module.css';

type Item={file:File;draftId:string};
type Outcome={name:string;message:string};
export function OriginalTransferForm({drafts,ready,language}:{drafts:{id:string;label:string}[];ready:boolean;language:Language}){
 const [items,setItems]=useState<Item[]>([]),[outcomes,setOutcomes]=useState<Outcome[]>([]),[busy,setBusy]=useState(false);
 const lock=useRef(false),es=language==='es';
 const tr=(en:string,spanish:string)=>es?spanish:en;
 async function transfer(){
  if(lock.current||!ready||items.length<1||items.length>25||items.some(x=>!drafts.some(d=>d.id===x.draftId)))return;
  lock.current=true;setBusy(true);setOutcomes([]);
  const results:Outcome[]=[];
  try{
   for(const item of items){
    let message:string;
    try{
     if(!item.file.name.toLowerCase().endsWith('.pdf')||item.file.size<128||item.file.size>ASSISTANT_MAX_PDF_BYTES)throw Error('invalid_pdf');
     const bytes=new Uint8Array(await item.file.arrayBuffer());
     if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('invalid_pdf');
     const digest=await crypto.subtle.digest('SHA-256',bytes);
     const sha256=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
     // Use the existing browser session. No token is read or exported by this sender.
     const response=await fetch('/api/admin/assistant-originals',{
      method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',
      headers:{'Content-Type':'application/pdf','x-mzs-cost-draft-id':item.draftId,
       'x-mzs-file-name':encodeURIComponent(item.file.name),'x-mzs-file-sha256':sha256},body:bytes
     });
     const result=await response.json();
     if(response.ok&&result.status==='archived_and_linked'&&result.archive_verified===true&&
       result.linked===true&&result.draft_id===item.draftId&&result.sha256===sha256&&result.payment_recorded===false){
      message=tr('Verified and linked: ','Verificado y vinculado: ')+result.document_id+' · SHA-256 '+sha256;
     }else if(response.status===202&&result.status==='archived_link_unconfirmed'){
      message=tr('Original retained; draft link needs review. Document: ','Original conservado; revisar vínculo. Documento: ')+result.document_id;
     }else{
      // Whitelist public error codes; never display an arbitrary server response or signed URL.
      const known=['not_found','scanner_not_approved','unauthenticated','forbidden','cross_origin_request',
       'invalid_headers','draft_unavailable','draft_not_found','too_large','pdf_required','invalid_pdf',
       'checksum_mismatch','malicious_pdf','scan_unavailable','archive_unavailable','original_superseded',
       'upload_failed','original_not_verified','archive_registration_unconfirmed'];
      message=tr('Transfer not confirmed: ','Transferencia no confirmada: ')+(known.includes(result.error)?result.error:'unknown_result');
     }
    }catch(error){
     message=error instanceof Error&&error.message==='invalid_pdf'?
      tr('Invalid PDF or larger than 4 MiB.','PDF no válido o superior a 4 MiB.'):
      tr('Result unknown. Check the archive before retrying.','Resultado desconocido. Revise el archivo antes de reintentar.');
    }
    results.push({name:item.file.name,message});setOutcomes([...results]);
   }
  }finally{lock.current=false;setBusy(false);}
 }
 return <div className={s.form}>
  <label className={s.wide}>{tr('Original PDFs (maximum 25; 4 MiB each)','PDF originales (máximo 25; 4 MiB cada uno)')}
   <input type="file" multiple accept="application/pdf,.pdf" disabled={busy||!ready}
    onChange={e=>{setItems(Array.from(e.target.files??[]).map(file=>({file,draftId:''})));setOutcomes([]);}}/>
  </label>
  {items.length>25&&<p role="alert">{tr('Maximum 25 files per batch.','Máximo 25 archivos por lote.')}</p>}
  {items.map((item,index)=><label className={s.wide} key={index}>{item.file.name}
   <select aria-label={tr('Expense draft for ','Concepto para ')+item.file.name} disabled={busy}
    value={item.draftId} onChange={e=>{const id=e.target.value;setItems(old=>old.map((x,i)=>i===index?{...x,draftId:id}:x));}}>
    <option value="">{tr('Choose the matching existing draft','Seleccione el concepto existente correspondiente')}</option>
    {drafts.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
   </select>
  </label>)}
  <button className={s.button} type="button" onClick={transfer}
   disabled={!ready||busy||!items.length||items.length>25||items.some(x=>!x.draftId)}>
   {busy?tr('Checking and transferring…','Comprobando y transfiriendo…'):tr('Scan, archive and link originals','Analizar, archivar y vincular originales')}
  </button>
  <div className={s.wide} role="status" aria-live="polite"><ul>{outcomes.map((r,i)=><li key={i}>{r.name}: {r.message}</li>)}</ul></div>
 </div>;
}
