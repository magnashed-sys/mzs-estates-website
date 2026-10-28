"use client";
import {useActionState} from "react";
import {recordStaffScope,initialScopeAction} from "./actions";
import s from "../../../../staff/staff.module.css";

type Member={id:string;full_name:string|null;role:string};
type Property={id:string;name:string};
export default function StaffScopeForm({members,properties}:{members:Member[];properties:Property[]}){
 const [state,action,pending]=useActionState(recordStaffScope,initialScopeAction);
 return <form className={s.form} action={action}>
  <h2>Toegang per object</h2>
  <p className={s.description}>Wijs alleen bestaande, actieve Staging-accounts toe. Dit verandert de cliëntrol niet en verleent geen toegang tot financiële dossiers.</p>
  <label>Bestaand account<select name="profile_id" required defaultValue="">
   <option value="" disabled>Selecteer bestaande actieve relatie</option>
   {members.map(m=><option key={m.id} value={m.id}>{m.full_name??"Onbenoemde relatie"} ({m.role})</option>)}
  </select></label>
  <label>Vastgoedobject<select name="property_id" required defaultValue="">
   <option value="" disabled>Kies vastgoedobject</option>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>Handeling<select name="scope_action" defaultValue="grant">
   <option value="grant">Objecttoegang verlenen</option>
   <option value="revoke">Objecttoegang intrekken</option>
  </select></label>
  <label>Reden / gecontroleerde opdracht<textarea rows={3} name="reason" minLength={8} maxLength={500} required
   placeholder="Wie heeft toestemming gegeven, voor welk object en waarom?"/></label>
  <button type="submit" disabled={pending||!members.length||!properties.length}>{pending?"Registreren…":"Toegang registreren"}</button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
 </form>;
}
