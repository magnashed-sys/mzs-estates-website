import {initialFormActionState} from "../../lib/property-operations/form-state";
"use client";
import {useActionState,useState} from "react";
import {saveActualStaffVisit,reportMaintenanceTicket} from "./actions";
import s from "./staff.module.css";
type Property={id:string;name:string;address:string};
type Unit={id:string;property_id:string;address:string};

function ActualVisitForm({properties,units}:{properties:Property[];units:Unit[]}){
 const [state,action,pending]=useActionState(saveActualStaffVisit,initialFormActionState);
 const [propertyId,setPropertyId]=useState(properties[0]?.id??"");
 const availableUnits=units.filter(u=>u.property_id===propertyId);
 return <form className={s.form} action={action}>
  <h2>Werkbezoek registreren</h2>
  <p className={s.description}>Registreer ieder werkelijk bezoek afzonderlijk. Deze minuten zijn nog geen factureerbare uren.</p>
  <label>Object<select required name="property_id" value={propertyId} onChange={e=>setPropertyId(e.target.value)}>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>Unit (optioneel)<select key={propertyId} name="unit_id" defaultValue="">
    <option value="">Gehele object / niet van toepassing</option>
    {availableUnits.map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
  </select></label>
  <div className={s.two}>
   <label>Werkdatum<input type="date" name="worked_on" required/></label>
   <label>Werkelijke minuten<input type="number" name="actual_minutes" min={1} max={960} step={1} required placeholder="Bijv. 45"/></label>
  </div>
  <label>Werksoort<select name="task_category" defaultValue="cleaning">
   <option value="cleaning">Schoonmaak</option>
   <option value="inspection">Controle</option>
   <option value="maintenance">Onderhoud</option>
   <option value="gardening">Tuin</option>
   <option value="guest_service">Gastenservice</option>
   <option value="other">Overig</option>
  </select></label>
  <label>Werkzaamheden<textarea name="description" required rows={3} minLength={3} maxLength={1500} placeholder="Wat heb je daadwerkelijk uitgevoerd?"/></label>
  <button type="submit" disabled={pending}>{pending?"Vastleggen…":"Werkbezoek opslaan"}</button>
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
export default function StaffForms(props:{properties:Property[];units:Unit[]}){
 return <div className={s.forms}><ActualVisitForm {...props}/><MaintenanceForm {...props}/></div>;
}
