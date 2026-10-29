"use client";
import {useAdminI18n} from '../../../lib/admin/i18n';

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
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [creation,create,pendingCreate]=useActionState(createPilotRun,idle);
 const [runState,changeRun,pendingRun]=useActionState(changePilotRunState,idle);
 const [scopeState,changeScope,pendingScope]=useActionState(changePilotWorkerScope,idle);
 return <div className={s.forms}>
  <section className={s.panel}>
   <h2>{adminT("1. New run (OFF by default)")}</h2>
   <form action={create}>
    <label>{adminT("Property")}<select name="property_id" required defaultValue=""><option value="" disabled>{adminT("Select verified property")}</option>
     {properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <label>{adminT("Purpose and authorization basis")}<textarea name="purpose" minLength={12} maxLength={300} required/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_synthetic" value="yes" required/>  {adminT("Synthetic test data only; nothing is invoiced.")}</label>
    <button disabled={pendingCreate||properties.length===0} type="submit">{adminT("Create run safely")}</button>
    {creation.message&&<p role={creation.status==="error"?"alert":"status"}>{creation.message}</p>}
   </form>
  </section>
  <section className={s.panel}>
   <h2>{adminT("2. Start or permanent stop")}</h2>
   <form action={changeRun}>
    <label>{adminT("Pilot run")}<select name="run_id" required defaultValue=""><option value="" disabled>{adminT("Select run")}</option>
     {runs.map(r=><option key={r.id} value={r.id}>{properties.find(p=>p.id===r.property_id)?.name??adminT("Property")} · {adminT(r.status)} · {r.id.slice(0,8)}</option>)}</select></label>
    <label>{adminT("Action")}<select name="action" required defaultValue="deactivate">
     <option value="deactivate">{adminT("Stop immediately and permanently")}</option><option value="activate">{adminT("Activate explicitly")}</option>
    </select></label>
    <label>{adminT("Supporting evidence")}<textarea name="reason" minLength={10} maxLength={500} required/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_stage" value="yes" required/>  {adminT("I have separately approved the associated test phase.")}</label>
    <button type="submit" disabled={pendingRun||runs.length===0}>{adminT("Record status with audit trail")}</button>
    {runState.message&&<p role={runState.status==="error"?"alert":"status"}>{runState.message}</p>}
   </form>
  </section>
  <section className={s.panel}>
   <h2>{adminT("3. One existing staff account")}</h2>
   <form action={changeScope}>
    <label>{adminT("Pilot run")}<select name="run_id" required defaultValue=""><option value="" disabled>{adminT("Select run")}</option>
     {runs.map(r=><option key={r.id} value={r.id}>{properties.find(p=>p.id===r.property_id)?.name??adminT("Property")} · {adminT(r.status)} · {r.id.slice(0,8)}</option>)}</select></label>
    <label>{adminT("Existing relationship")}<select name="profile_id" defaultValue="" required>
     <option value="" disabled>{adminT("Verify identity and role")}</option>
     {members.map(m=><option value={m.id} key={m.id}>{m.full_name??adminT("Unknown name")} ({adminT(m.role)})</option>)}
    </select></label>
    <label>{adminT("Assignment")}<select name="action" defaultValue="revoke" required>
     <option value="revoke">{adminT("Revoke access immediately")}</option><option value="grant">{adminT("Grant access to this pilot")}</option>
    </select></label>
    <label>{adminT("Verified supporting evidence")}<textarea name="reason" minLength={10} maxLength={500} required/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_stage" value="yes" required/>  {adminT("I have checked this account and the correct property.")}</label>
    <button type="submit" disabled={pendingScope||runs.length===0||members.length===0}>{adminT("Record access")}</button>
    {scopeState.message&&<p role={scopeState.status==="error"?"alert":"status"}>{scopeState.message}</p>}
   </form>
  </section>
 </div>;
}
