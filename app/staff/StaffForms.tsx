"use client";
import {initialFormActionState} from "../../lib/property-operations/form-state";
import {useActionState,useState} from "react";
import {saveActualStaffVisit,reportMaintenanceTicket} from "./actions";
import type {PropertyTask} from "../../lib/property-operations/property-tasks";
import s from "./staff.module.css";
import {staffText,type StaffLanguage} from "../../lib/property-operations/staff-copy";
type Property={id:string;name:string;address:string};
type Unit={id:string;property_id:string;address:string};

function ActualVisitForm({properties,units,tasks=[],today,language}:{properties:Property[];units:Unit[];tasks?:PropertyTask[];today:string;language:StaffLanguage}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [state,action,pending]=useActionState(saveActualStaffVisit,initialFormActionState);
 const [propertyId,setPropertyId]=useState(properties[0]?.id??"");
 const [unitId,setUnitId]=useState("");
 const [hours,setHours]=useState(0),[minutes,setMinutes]=useState(30);
 const adjustHours=(change:number)=>setHours(value=>Math.min(16,Math.max(0,value+change)));
 const adjustMinutes=(change:number)=>setMinutes(value=>Math.min(45,Math.max(0,value+change*15)));
 const availableUnits=units.filter(u=>u.property_id===propertyId);
 const possibleTasks=tasks.filter(t=>t.property_id===propertyId&&
   (!t.unit_id||t.unit_id===unitId)&&t.status!=='cancelled');
 const actualMinutes=hours*60+minutes;
 return <form className={s.form} action={action}>
  <h2>{t("workingTime")}</h2>
  <p className={s.description}>{t("hoursInfo")}</p>
  <label>{t('property')}<select required name="property_id" value={propertyId} onChange={e=>{setPropertyId(e.target.value);setUnitId('');}}>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>{t('unit')}<select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
   <option value="">{t('whole')}</option>
   {availableUnits.map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
  </select></label>
  <div className={s.timeEntryControls}>
   <label className={s.timeDate}>{t('dateLabel')}
    <input type="date" name="worked_on" defaultValue={today} required/>
   </label>
   <div className={s.timeStepper}>
    <span>{t('hours')}</span>
    <div className={s.timeButtons}>
     <button type="button" onClick={()=>adjustHours(-1)} disabled={pending||hours===0} aria-label={t('hours')+' −1'}>↓</button>
     <output aria-live="polite">{hours}</output>
     <input type="hidden" name="hours" value={hours}/>
     <button type="button" onClick={()=>adjustHours(1)} disabled={pending||hours===16} aria-label={t('hours')+' +1'}>↑</button>
    </div>
   </div>
   <div className={s.timeStepper}>
    <span>{t('minutes')}</span>
    <div className={s.timeButtons}>
     <button type="button" onClick={()=>adjustMinutes(-1)} disabled={pending||minutes===0} aria-label={t('minutes')+' −15'}>↓</button>
     <output aria-live="polite">{minutes}</output>
     <input type="hidden" name="minutes" value={minutes}/>
     <button type="button" onClick={()=>adjustMinutes(1)} disabled={pending||minutes===45} aria-label={t('minutes')+' +15'}>↑</button>
    </div>
   </div>
  </div>
  <p className={s.taskMeta}>{t('total')}: {hours}h {String(minutes).padStart(2,'0')}m</p>
  {tasks.length>0&&<label>{t('relatedTask')}<select name="task_id" key={propertyId+'-'+unitId} defaultValue="">
   <option value="">{t('generalTask')}</option>
   {possibleTasks.map(t=><option key={t.id} value={t.id}>{t.title} · {t.status.replaceAll('_',' ')}</option>)}
  </select></label>}
  <label>{t('workCategory')}<select name="task_category" defaultValue="cleaning">
   <option value="cleaning">{t('cleaning')}</option>
   <option value="inspection">{t('inspection')}</option>
   <option value="maintenance">{t('maintenanceCategory')}</option>
   <option value="gardening">{t('gardening')}</option>
   <option value="guest_service">{t('guestService')}</option>
   <option value="other">{t('other')}</option>
  </select></label>
  <label>{t('descriptionWork')}<textarea name="description" required rows={3} minLength={3} maxLength={1500} placeholder={t('descriptionWork')}/></label>
  <button type="submit" disabled={pending||actualMinutes<1||actualMinutes>960}>{pending?t('saving'):t('saveTime')}</button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
 </form>;
}
function MaintenanceForm({properties,units}:{properties:Property[];units:Unit[]}){
 const [state,action,pending]=useActionState(reportMaintenanceTicket,initialFormActionState);
 const [propertyId,setPropertyId]=useState(properties[0]?.id??"");
 const availableUnits=units.filter(u=>u.property_id===propertyId);
 return <form className={s.form} action={action}>
  <h2>Onderhoud melden</h2>
  <p className={s.description}>Een melding is nog geen opdracht of factuur. Bij direct gevaar neem je contact op met de verantwoordelijke beheerder.</p>
  <label>Object<select name="property_id" required value={propertyId} onChange={e=>setPropertyId(e.target.value)}>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>Unit (optioneel)<select key={propertyId} name="unit_id" defaultValue="">
    <option value="">Algemene ruimte / geheel object</option>
    {availableUnits.map(u=><option value={u.id} key={u.id}>{u.address}</option>)}
  </select></label>
  <label>Urgentie<select name="priority" defaultValue="routine">
   <option value="routine">Normaal</option>
   <option value="soon">Binnenkort beoordelen</option>
   <option value="urgent">Dringend</option>
  </select></label>
  <label>Onderwerp<input name="title" minLength={5} maxLength={140} required placeholder="Bijv. waterlekkage"/></label>
  <label>Beschrijving<textarea name="description" minLength={8} maxLength={3000} rows={4} required placeholder="Wat is er gebeurd? Waar bevindt het probleem zich?"/></label>
  <button disabled={pending} type="submit">{pending?"Melden…":"Onderhoudsmelding versturen"}</button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
 </form>;
}
export default function StaffForms(props:{properties:Property[];units:Unit[];tasks?:PropertyTask[];today:string;showMaintenanceForm?:boolean;language:StaffLanguage}){
 // The task-enabled mobile cockpit provides one unified entry point.
 // Keep the legacy maintenance form only where the task feature is disabled.
 return <div className={s.forms}>
  <ActualVisitForm {...props}/>
  {props.showMaintenanceForm!==false&&<MaintenanceForm {...props}/>}
 </div>;
}
