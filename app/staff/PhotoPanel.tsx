'use client';
import Image from 'next/image';
import {useAdminI18n} from '../../lib/admin/i18n';

import {useState,useActionState} from 'react';
import {useRouter} from 'next/navigation';
import {holdMaintenancePhoto} from '../admin/workspaces/estates/staff/work-order-actions';
import {initialFormActionState} from '../../lib/property-operations/form-state';
import s from './staff.module.css';
export type Photo={id:string;created_at:string;held?:boolean};
function HoldPhoto({id}:{id:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,action,pending]=useActionState(holdMaintenancePhoto,initialFormActionState);
 return <details><summary>{adminT("Hide photo")}</summary><form action={action} className={s.form}><input type="hidden" name="photo_id" value={id}/><label>{adminT("Reason")}<input name="reason" minLength={8} maxLength={500} required/></label><p>{adminT("The photo will no longer be displayed or downloadable. The file and decision are retained; this cannot be reversed from this screen.")}</p><button disabled={pending}>{adminT("Hide")}</button>{state.message&&<p role="status">{adminT(state.message)}</p>}</form></details>;
}
export default function PhotoPanel({ticketId,photos,admin=false}:{ticketId:string;photos:Photo[];admin?:boolean}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const router=useRouter(),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function upload(event:React.FormEvent<HTMLFormElement>){
 event.preventDefault();if(pending)return;const form=event.currentTarget,body=new FormData(form);setPending(true);setMessage('');
 try{const response=await fetch('/api/staff/maintenance-photo',{method:'POST',body});const payload=await response.json();setMessage(typeof payload.message==='string'?payload.message:"Photo could not be saved.");if(response.ok){form.reset();router.refresh();}}catch{setMessage("Upload not confirmed. Refresh the overview before uploading again.");}finally{setPending(false);}
 }
 return <section className={s.photoPanel}><h3>{adminT("Maintenance photos")}</h3><p>{adminT("Add only the maintenance issue. Avoid people and private documents. Photos are retained with the report; report unwanted content to the administrator.")}</p><ul className={s.photoGallery}>{photos.map(p=><li key={p.id}>{p.held?<span>{adminT("Photo hidden ·")} {p.created_at.slice(0,10)}</span>:<>
   <a className={s.photoThumbnail} href={'/api/staff/maintenance-photo/'+p.id} target="_blank" rel="noopener noreferrer">
    <Image unoptimized loading="lazy" src={'/api/staff/maintenance-photo/'+p.id}
      alt={adminT("Maintenance photos")+' · '+p.created_at.slice(0,10)} width={240} height={160}/>
    <span>{adminT("View photo ·")} {p.created_at.slice(0,10)}</span>
   </a>
   {admin&&<HoldPhoto id={p.id}/>}
  </>}</li>)}</ul>{!photos.length&&<p>{adminT("No visible photos yet.")}</p>}{photos.length<3&&<form onSubmit={upload} className={s.form}><input type="hidden" name="ticket_id" value={ticketId}/><label>{adminT("Photo (JPEG, PNG or WebP, maximum 4 MB)")}<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required/></label><button disabled={pending}>{pending?adminT("Processing photo…"):adminT("Add photo")}</button>{message&&<p role="status">{adminT(message)}</p>}</form>}</section>;
}
