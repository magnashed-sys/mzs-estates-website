"use client";
import {useActionState} from "react";
import {addPropertyEntityLink,type EntityLinkActionState} from "./actions";
import styles from "./entities.module.css";
const initial:EntityLinkActionState={status:"idle",message:""};
type Option={id:string;name:string};

export default function EntityLinkForm({properties,issuers}:{
 properties:Option[];issuers:Option[];
}){
 const [state,action,pending]=useActionState(addPropertyEntityLink,initial);
 return <section className={styles.panel} aria-labelledby="new-entity-link">
  <p className={styles.kicker}>VERIFIED ADMINISTRATIVE ALLOCATION</p>
  <h2 id="new-entity-link">Record a new association</h2>
  <p className={styles.hint}>Select the existing property and the correct legal entity. This record provides internal evidence of the specified relationship and does <strong>not</strong> automatically determine VAT, legal title, expenses or invoices to issue.</p>
  <form action={action} className={styles.form}>
   <div className={styles.fields}>
    <label>Property
     <select name="property_id" defaultValue="" required>
      <option value="" disabled>Choose the correct property</option>
      {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>
    <label>Legal entity
     <select name="legal_entity_id" defaultValue="" required>
      <option value="" disabled>Choose the registered entity</option>
      {issuers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>
    <label>Relationship type
     <select name="relationship_type" defaultValue="payer" required>
      <option value="payer">Cost bearer / payer</option>
      <option value="owner">Legal owner</option>
      <option value="manager">Manager</option>
     </select>
    </label>
    <label>Valid from
     <input type="date" name="effective_from" required/>
    </label>
   </div>
   <label>Evidence reference or supporting information
    <textarea name="evidence_reference" minLength={6} maxLength={500}
     placeholder="For example, a verified agreement, title deed or written authorization" required/>
   </label>
   <label className={styles.confirmation}>
    <input type="checkbox" name="confirmed" value="yes" required/>
    <span>I have checked the relationship and effective date. I understand that this association and its evidence will be recorded in an immutable audit history.</span>
   </label>
   <button disabled={pending||properties.length===0||issuers.length===0} type="submit">
    {pending?"Saving association…":"Record verified association"}
   </button>
   {state.message&&<p className={state.status==="error"?styles.error:styles.notice}
     role={state.status==="error"?"alert":"status"}>{state.message}</p>}
  </form>
  <p className={styles.warning}>Once recorded, an association cannot be removed or silently changed at this stage. Record it only after checking the supporting evidence.</p>
 </section>;
}
