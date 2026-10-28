'use client';
import {useState,useActionState} from 'react';
import {useRouter} from 'next/navigation';
import {holdMaintenancePhoto} from '../admin/workspaces/estates/staff/work-order-actions';
import {initialFormActionState} from '../../lib/property-operations/form-state';
import s from './staff.module.css';
export type Photo={id:string;created_at:string;held?:boolean};
function HoldPhoto({id}:{id:string}){
 const [state,action,pending]=useActionState(holdMaintenancePhoto,initialFormActionState);
 return <details><summary>Foto afschermen</summary><form action={action} className={s.form}><input type="hidden" name="photo_id" value={id}/><label>Reden<input name="reason" minLength={8} maxLength={500} required/></label><p>De foto wordt niet meer getoond of gedownload. Het bestand en de beslissing blijven bewaard; dit kan niet via dit scherm worden teruggedraaid.</p><button disabled={pending}>Afschermen</button>{state.message&&<p role="status">{state.message}</p>}</form></details>;
}
export default function PhotoPanel({ticketId,photos,admin=false}:{ticketId:string;photos:Photo[];admin?:boolean}){
 const router=useRouter(),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function upload(event:React.FormEvent<HTMLFormElement>){
 event.preventDefault();if(pending)return;const form=event.currentTarget,body=new FormData(form);setPending(true);setMessage('');
 try{const response=await fetch('/api/staff/maintenance-photo',{method:'POST',body});const payload=await response.json();setMessage(typeof payload.message==='string'?payload.message:'Foto kon niet worden opgeslagen.');if(response.ok){form.reset();router.refresh();}}catch{setMessage('Upload niet bevestigd. Vernieuw het overzicht voordat je opnieuw uploadt.');}finally{setPending(false);}
 }
 return <section className={s.photoPanel}><h3>Onderhoudsfoto’s</h3><p>Voeg alleen het onderhoudsprobleem toe. Vermijd personen en privé-documenten. Foto’s blijven bij de melding bewaard; meld ongewenste inhoud bij de beheerder.</p><ul>{photos.map(p=><li key={p.id}>{p.held?<span>Foto afgeschermd · {p.created_at.slice(0,10)}</span>:<><a href={'/api/staff/maintenance-photo/'+p.id} target="_blank" rel="noopener noreferrer">Bekijk foto · {p.created_at.slice(0,10)}</a>{admin&&<HoldPhoto id={p.id}/>}</>}</li>)}</ul>{!photos.length&&<p>Nog geen zichtbare foto’s.</p>}{photos.length<3&&<form onSubmit={upload} className={s.form}><input type="hidden" name="ticket_id" value={ticketId}/><label>Foto (JPEG, PNG of WebP, maximaal 4 MB)<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required/></label><button disabled={pending}>{pending?'Foto verwerken…':'Foto toevoegen'}</button>{message&&<p role="status">{message}</p>}</form>}</section>;
}
