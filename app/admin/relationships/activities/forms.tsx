'use client';

import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createCrmActivity,updateCrmTask} from './actions';
import type {CrmActionResult,CrmActivity} from '../../../../lib/relationships/crm-activities';
import s from './activities.module.css';

type Choice={id:string;name:string;kind:string};
const idle:CrmActionResult={status:'idle',message:''};

export function CrmActivityCreate({relationships,initialRelationship,language}:{relationships:Choice[];initialRelationship:string;language:string}){
 const l=(en:string,es:string)=>language==='es'?es:en;
 const [kind,setKind]=useState('task');
 const [state,action,pending]=useActionState(createCrmActivity,idle);
 const router=useRouter();
 useEffect(()=>{if(state.status==='success')router.refresh();},[state,router]);
 return <section className={s.panel} aria-label={l('Add CRM contact or follow-up','Añadir contacto o tarea CRM')}>
  <h2>{l('Record a contact or follow-up','Registrar contacto o seguimiento')}</h2>
  <form action={action} className={s.form}>
   <label>{l('Relationship','Relación')}
    <select name="relationship_id" defaultValue={initialRelationship} required disabled={pending}>
     <option value="" disabled>{l('Select the verified CRM relationship','Seleccione la relación CRM verificada')}</option>
     {relationships.map(r=><option key={r.id} value={r.id}>{r.name} · {r.kind==='company'?l('Company','Empresa'):l('Person','Persona')}</option>)}
    </select>
   </label>
   <label>{l('Activity','Actividad')}
    <select name="kind" value={kind} onChange={event=>setKind(event.target.value)} disabled={pending}>
     <option value="task">{l('Follow-up task','Tarea de seguimiento')}</option>
     <option value="call">{l('Telephone call','Llamada telefónica')}</option>
     <option value="email">{l('Email contact (note only)','Contacto por correo (solo nota)')}</option>
     <option value="meeting">{l('Meeting','Reunión')}</option>
     <option value="note">{l('Internal note','Nota interna')}</option>
    </select>
   </label>
   <label>{l('Subject','Asunto')}<input type="text" name="title" required minLength={3} maxLength={180} disabled={pending}/></label>
   <label className={s.wide}>{l('Details / follow-up notes','Detalles / notas de seguimiento')}
    <textarea name="detail" maxLength={4000} rows={3} disabled={pending} placeholder={l('Internal notes; no email is sent','Notas internas; no se envía ningún correo')}/>
   </label>
   {kind==='task'?<label>{l('Due date (optional)','Fecha límite (opcional)')}<input name="due_on" type="date" min="2000-01-01" max="2099-12-31" disabled={pending}/></label>:<input name="due_on" type="hidden" value=""/>}
   <div className={s.formActions}>
    <button type="submit" disabled={pending||relationships.length===0}>{pending?l('Saving…','Guardando…'):l('Save activity','Guardar actividad')}</button>
    <p>{l('An activity is only an internal note. Status and later task changes remain auditable.','Una actividad es una nota interna. Los cambios posteriores quedan auditados.')}</p>
   </div>
  </form>
  {state.message&&<p role={state.status==='error'?'alert':'status'} className={state.status==='error'?s.error:s.confirmation}>{l(state.message,state.status==='success'?'Actividad guardada.':'No se pudo guardar. Revise los campos e inténtelo de nuevo.')}</p>}
 </section>;
}

export function CrmTaskUpdate({task,language}:{task:CrmActivity;language:string}){
 const l=(en:string,es:string)=>language==='es'?es:en;
 const [state,action,pending]=useActionState(updateCrmTask,idle);
 const router=useRouter();
 useEffect(()=>{if(state.status==='success')router.refresh();},[state,router]);
 return <details className={s.update}>
  <summary>{l('Update follow-up','Actualizar tarea')}</summary>
  <form action={action} className={s.updateForm}>
   <input type="hidden" name="id" value={task.id}/>
   <input type="hidden" name="revision" value={task.version}/>
   <label>{l('Task status','Estado de la tarea')}
    <select name="status" defaultValue={task.status} disabled={pending}>
     <option value="open">{l('Open','Abierta')}</option>
     <option value="done">{l('Completed','Completada')}</option>
    </select>
   </label>
   <label>{l('Due date','Fecha límite')}<input name="due_on" type="date" defaultValue={task.due_on??''} min="2000-01-01" max="2099-12-31" disabled={pending}/></label>
   <button type="submit" disabled={pending}>{pending?l('Updating…','Actualizando…'):l('Record update','Registrar cambio')}</button>
  </form>
  {state.message&&<p role={state.status==='error'?'alert':'status'}>{l(state.message,state.status==='success'?'Cambio registrado.':'Error al actualizar. Vuelva a cargar la lista.')}</p>}
  <p className={s.note}>{l('To record new progress details, add a new contact note instead of rewriting historical notes.','Para registrar nuevos detalles, añada otra nota en lugar de sobrescribir el historial.')}</p>
 </details>;
}
