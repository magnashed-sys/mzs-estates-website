"use client";
import {initialFormActionState} from "../../../../../lib/property-operations/form-state";
import {useActionState} from "react";
import {recordStaffScope} from "./actions";
import s from "../../../../staff/staff.module.css";

type Member={id:string;full_name:string|null;role:string};
type Property={id:string;name:string};
export default function StaffScopeForm({members,properties}:{members:Member[];properties:Property[]}){
 const [state,action,pending]=useActionState(recordStaffScope,initialFormActionState);
 return <form className={s.form} action={action}>
  <h2>Access by property</h2>
  <p className={s.description}>Assign existing accounts only. This does not change the client role or grant access to financial dossiers.</p>
  <label>Existing account<select name="profile_id" required defaultValue="">
   <option value="" disabled>Select an existing active relationship</option>
   {members.map(m=><option key={m.id} value={m.id}>{m.full_name??"Onbenoemde relatie"} ({m.role})</option>)}
  </select></label>
  <label>Property<select name="property_id" required defaultValue="">
   <option value="" disabled>Choose property</option>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>Action<select name="scope_action" defaultValue="grant">
   <option value="grant">Grant property access</option>
   <option value="revoke">Revoke property access</option>
  </select></label>
  <label>Reason / verified assignment<textarea rows={3} name="reason" minLength={8} maxLength={500} required
   placeholder="Who authorized access, for which property and why?"/></label>
  <button type="submit" disabled={pending||!members.length||!properties.length}>{pending?"Recording…":"Record access"}</button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
 </form>;
}
