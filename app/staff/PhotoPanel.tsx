'use client';
import {useState,useActionState} from 'react';
import {useRouter} from 'next/navigation';
import {holdMaintenancePhoto} from '../admin/workspaces/estates/staff/work-order-actions';
import {initialFormActionState} from '../../lib/property-operations/form-state';
import s from './staff.module.css';
export type Photo={id:string;created_at:string;held?:boolean};
function HoldPhoto({id}:{id:string}){
 const [state,action,pending]=useActionState(holdMaintenancePhoto,initialFormActionState);
 return <details><summary>Hide photo</summary><form action={action} className={s.form}><input type="hidden" name="photo_id" value={id}/><label>Reason<input name="reason" minLength={8} maxLength={500} required/></label><p>The photo will no longer be displayed or downloadable. The file and decision are retained; this cannot be reversed from this screen.</p><button disabled={pending}>Hide</button>{state.message&&<p role="status">{state.message}</p>}</form></details>;
}
export default function PhotoPanel({ticketId,photos,admin=false}:{ticketId:string;photos:Photo[];admin?:boolean}){
 const router=useRouter(),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function upload(event:React.FormEvent<HTMLFormElement>){
 event.preventDefault();if(pending)return;const form=event.currentTarget,body=new FormData(form);setPending(true);setMessage('');
 try{const response=await fetch('/api/staff/maintenance-photo',{method:'POST',body});const payload=await response.json();setMessage(typeof payload.message==='string'?payload.message:"Photo could not be saved.");if(response.ok){form.reset();router.refresh();}}catch{setMessage("Upload not confirmed. Refresh the overview before uploading again.");}finally{setPending(false);}
 }
 return <section className={s.photoPanel}><h3>Maintenance photos</h3><p>Add only the maintenance issue. Avoid people and private documents. Photos are retained with the report; report unwanted content to the administrator.</p><ul>{photos.map(p=><li key={p.id}>{p.held?<span>Photo hidden · {p.created_at.slice(0,10)}</span>:<><a href={'/api/staff/maintenance-photo/'+p.id} target="_blank" rel="noopener noreferrer">View photo · {p.created_at.slice(0,10)}</a>{admin&&<HoldPhoto id={p.id}/>}</>}</li>)}</ul>{!photos.length&&<p>No visible photos yet.</p>}{photos.length<3&&<form onSubmit={upload} className={s.form}><input type="hidden" name="ticket_id" value={ticketId}/><label>Photo (JPEG, PNG or WebP, maximum 4 MB)<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required/></label><button disabled={pending}>{pending?"Processing photo…":"Add photo"}</button>{message&&<p role="status">{message}</p>}</form>}</section>;
}
