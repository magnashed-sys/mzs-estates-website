"use client";
import {useActionState} from "react";
import {createPilotRun,changePilotRunState,changePilotWorkerScope,type PilotAdminState} from "./actions";
import s from "../../pilot/staff/pilot.module.css";
const idle:PilotAdminState={status:"idle",message:""};
type Run={id:string;property_id:string;status:string};
type Property={id:string;name:string};
type Member={id:string;full_name:string|null;role:string};
export default function PilotAdminForms({runs,properties,members}:{
 runs:Run[];properties:Property[];members:Member[];
}){
 const [creation,create,pendingCreate]=useActionState(createPilotRun,idle);
 const [runState,changeRun,pendingRun]=useActionState(changePilotRunState,idle);
 const [scopeState,changeScope,pendingScope]=useActionState(changePilotWorkerScope,idle);
 return <div className={s.forms}>
  <section className={s.panel}>
   <h2>1. Nieuwe run (standaard UIT)</h2>
   <form action={create}>
    <label>Object<select name="property_id" required defaultValue=""><option value="" disabled>Selecteer bevestigd object</option>
     {properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <label>Doel en autorisatiegrond<textarea name="purpose" minLength={12} maxLength={300} required/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_synthetic" value="yes" required/> Alleen fictieve testgegevens; er wordt niets gefactureerd.</label>
    <button disabled={pendingCreate||properties.length===0} type="submit">Run veilig aanmaken</button>
    {creation.message&&<p role={creation.status==="error"?"alert":"status"}>{creation.message}</p>}
   </form>
  </section>
  <section className={s.panel}>
   <h2>2. Start of definitieve stop</h2>
   <form action={changeRun}>
    <label>Pilotrun<select name="run_id" required defaultValue=""><option value="" disabled>Selecteer run</option>
     {runs.map(r=><option key={r.id} value={r.id}>{properties.find(p=>p.id===r.property_id)?.name??"Object"} · {r.status} · {r.id.slice(0,8)}</option>)}</select></label>
    <label>Handeling<select name="action" required defaultValue="deactivate">
     <option value="deactivate">Direct en definitief stoppen</option><option value="activate">Expliciet activeren</option>
    </select></label>
    <label>Onderbouwing<textarea name="reason" minLength={10} maxLength={500} required/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_stage" value="yes" required/> Ik heb de bijbehorende testfase afzonderlijk goedgekeurd.</label>
    <button type="submit" disabled={pendingRun||runs.length===0}>Status met audit registreren</button>
    {runState.message&&<p role={runState.status==="error"?"alert":"status"}>{runState.message}</p>}
   </form>
  </section>
  <section className={s.panel}>
   <h2>3. Eén bestaand medewerkersaccount</h2>
   <form action={changeScope}>
    <label>Pilotrun<select name="run_id" required defaultValue=""><option value="" disabled>Selecteer run</option>
     {runs.map(r=><option key={r.id} value={r.id}>{properties.find(p=>p.id===r.property_id)?.name??"Object"} · {r.status} · {r.id.slice(0,8)}</option>)}</select></label>
    <label>Bestaande relatie<select name="profile_id" defaultValue="" required>
     <option value="" disabled>Controleer identiteit en functie</option>
     {members.map(m=><option value={m.id} key={m.id}>{m.full_name??"Naam onbekend"} ({m.role})</option>)}
    </select></label>
    <label>Toewijzing<select name="action" defaultValue="revoke" required>
     <option value="revoke">Toegang direct intrekken</option><option value="grant">Toegang geven voor deze pilot</option>
    </select></label>
    <label>Geverifieerde onderbouwing<textarea name="reason" minLength={10} maxLength={500} required/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_stage" value="yes" required/> Ik heb dit account en het juiste object gecontroleerd.</label>
    <button type="submit" disabled={pendingScope||runs.length===0||members.length===0}>Toegang registreren</button>
    {scopeState.message&&<p role={scopeState.status==="error"?"alert":"status"}>{scopeState.message}</p>}
   </form>
  </section>
 </div>;
}
