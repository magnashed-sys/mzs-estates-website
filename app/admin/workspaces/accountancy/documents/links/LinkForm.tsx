'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {attachmentCopy,type LinkKind} from '../../../../../../lib/accountancy/document-links';
import type {Language} from '../../../../../../lib/accountancy/archive';
import {saveDocumentLink,removeDocumentLink} from './actions';
import s from '../archive.module.css';
export function LinkForm({kind,targetId,documentId,linkId,language}:{kind:LinkKind;targetId:string;documentId:string;linkId?:string;language:Language}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false),router=useRouter(),t=attachmentCopy[language];
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  try{const result=await (linkId?removeDocumentLink:saveDocumentLink)(new FormData(event.currentTarget));if(!result.ok)throw Error();setNotice(t.saved);router.refresh();}
  catch{setNotice(t.failed);}finally{lock.current=false;setBusy(false);}
 }
 return <form onSubmit={submit}><input type="hidden" name="kind" value={kind}/><input type="hidden" name="target_id" value={targetId}/><input type="hidden" name="document_id" value={documentId}/>{linkId&&<input type="hidden" name="link_id" value={linkId}/>}
 <fieldset disabled={busy} className={s.form}>{linkId&&<label>{t.reason}<input name="reason" minLength={2} maxLength={500} required/></label>}<button className={s.button}>{linkId?t.remove:t.link}</button></fieldset>{notice&&<p role="status">{notice}</p>}</form>;
}
