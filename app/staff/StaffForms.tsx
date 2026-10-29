"use client";
import {initialFormActionState} from "../../lib/property-operations/form-state";
import {useActionState,useState} from "react";
import {saveActualStaffVisit,reportMaintenanceTicket} from "./actions";
import type {PropertyTask} from "../../lib/property-operations/property-tasks";
import s from "./staff.module.css";
type Property={id:string;name:string;address:string};
type Unit={id:string;property_id:string;address:string};

function ActualVisitForm({properties,units,tasks=[],today}:{properties:Property[];units:Unit[];tasks?:PropertyTask[];today:string}){
 const [state,action,pending]=useActionState(saveActualStaffVisit,initialFormActionState);
 const [propertyId,setPropertyId]=useState(properties[0]?.id??"");
 const [unitId,setUnitId]=useState("");
 const [hours,setHours]=useState(0),[minutes,setMinutes]=useState(30);
 const availableUnits=units.filter(u=>u.property_id===propertyId);
 const possibleTasks=tasks.filter(t=>t.property_id===propertyId&&
   (!t.unit_id||t.unit_id===unitId)&&t.status!=='cancelled');
 const actualMinutes=hours*60+minutes;
 return <form className={s.form} action={action}>
  <h2>Log working time</h2>
  <p className={s.description}>Record each actual visit separately. No salary, billing or invoice is created.</p>
  <label>Property<select required name="property_id" value={propertyId} onChange={e=>{setPropertyId(e.target.value);setUnitId('');}}>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>Unit (optional)<select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
   <option value="">Whole property / general area</option>
   {availableUnits.map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
  </select></label>
  <div className={s.two}>
   <label>Work date<input type="date" name="worked_on" defaultValue={today} required/></label>
   <label>Hours<input type="number" name="hours" value={hours} onChange={e=>setHours(Number(e.target.value))} min={0} max={16} step={1} required/></label>
   <label>Minutes<input type="number" name="minutes" value={minutes} onChange={e=>setMinutes(Number(e.target.value))} min={0} max={59} step={1} required/></label>
  </div>
  <p className={s.taskMeta}>Total: {Number.isFinite(actualMinutes)?actualMinutes:0} minutes</p>
  {tasks.length>0&&<label>Related task (optional)<select name="task_id" key={propertyId+'-'+unitId} defaultValue="">
   <option value="">General work / no specific task</option>
   {possibleTasks.map(t=><option key={t.id} value={t.id}>{t.title} · {t.status.replaceAll('_',' ')}</option>)}
  </select></label>}
  <label>Work category<select name="task_category" defaultValue="cleaning">
   <option value="cleaning">Cleaning</option>
   <option value="inspection">Inspection</option>
   <option value="maintenance">Maintenance</option>
   <option value="gardening">Gardening</option>
   <option value="guest_service">Guest service</option>
   <option value="other">Other</option>
  </select></label>
  <label>Work performed<textarea name="description" required rows={3} minLength={3} maxLength={1500} placeholder="What did you actually do?"/></label>
  <button type="submit" disabled={pending||actualMinutes<1||actualMinutes>960}>{pending?"Saving…":"Save working time"}</button>
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
export default function StaffForms(props:{properties:Property[];units:Unit[];tasks?:PropertyTask[];today:string;showMaintenanceForm?:boolean}){
 // The task-enabled mobile cockpit provides one unified entry point.
 // Keep the legacy maintenance form only where the task feature is disabled.
 return <div className={s.forms}>
  <ActualVisitForm {...props}/>
  {props.showMaintenanceForm!==false&&<MaintenanceForm {...props}/>}
 </div>;
}
