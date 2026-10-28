"use client";
import {initialFormActionState} from "../../../../../lib/property-operations/form-state";
import {useActionState,useState} from "react";
import {linkSupplierReplacement} from "./replacement-actions";
import styles from "./expenses.module.css";
type Correction={id:string;draft_id:string};
type Decision={correction_id:string;decision:string};
type Draft={id:string;property_id:string;legal_entity_id:string;supplier_relationship_id:string;supplier_invoice_number:string};
type Review={draft_id:string;sequence_no:number;action:string};
type Document={draft_id:string};
type Link={id:string;correction_id:string;replacement_draft_id:string};
function ReplacementForm({correction,drafts,reviewed,documentIds}:{
 correction:Correction;drafts:Draft[];reviewed:Map<string,string>;documentIds:Set<string>
}){
 const [state,action,pending]=useActionState(linkSupplierReplacement,initialFormActionState);
 const [replacementId,setReplacementId]=useState("");
 const original=drafts.find(d=>d.id===correction.draft_id);
 const valid=original?drafts.filter(d=>d.id!==original.id &&
   d.property_id===original.property_id&&
   d.legal_entity_id===original.legal_entity_id&&
   d.supplier_relationship_id===original.supplier_relationship_id&&
   reviewed.get(d.id)==="approved"&&documentIds.has(d.id)): [];
 return <form action={action} className={styles.fields} style={{marginTop:12}}>
  <p className={styles.hint}>Origineel {original?.supplier_invoice_number??"niet in huidig overzicht"}. Een vervanging heeft een eigen leveranciersreferentie, brondocument en goedkeuring nodig.</p>
  <input type="hidden" name="correction_id" value={correction.id}/>
  <label>Afzonderlijk goedgekeurde vervangende factuur
   <select name="replacement_draft_id" value={replacementId} onChange={e=>setReplacementId(e.target.value)} required>
    <option value="">Selecteer nieuw dossier</option>
    {valid.map(d=><option key={d.id} value={d.id}>{d.supplier_invoice_number}</option>)}
   </select>
  </label>
  <label>Waarop is de koppeling gecontroleerd?
   <textarea name="verification_note" minLength={12} maxLength={1000} rows={2} required
    placeholder="Bijvoorbeeld leverancier heeft correctiefactuur X uitgereikt ter vervanging van factuur Y."/>
  </label>
  <button type="submit" className={styles.saveButton} disabled={!replacementId||pending}>
   {pending?"Koppelen…":"Vervangende factuur gecontroleerd koppelen"}
  </button>
  {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.hint}>{state.message}</p>}
  {valid.length===0&&<p className={styles.hint}>Er is nog geen nieuwe, afzonderlijk goedgekeurde inkoopfactuur met dezelfde entiteit, leverancier en object beschikbaar.</p>}
 </form>;
}
export default function ExpenseReplacementLinks({corrections,decisions,drafts,reviews,documents,links,enabled}:{
 corrections:Correction[];decisions:Decision[];drafts:Draft[];reviews:Review[];
 documents:Document[];links:Link[];enabled:boolean
}){
 const decisionMap=new Map(decisions.map(x=>[x.correction_id,x.decision]));
 const linked=new Map(links.map(x=>[x.correction_id,x]));
 const documented=new Set(documents.map(x=>x.draft_id));
 const latest=new Map<string,Review>();
 for(const r of reviews){const last=latest.get(r.draft_id);if(!last||r.sequence_no>last.sequence_no)latest.set(r.draft_id,r);}
 const reviewed=new Map([...latest].map(([id,r])=>[id,r.action]));
 const relevant=corrections.filter(c=>decisionMap.get(c.id)==="replacement_required");
 return <section className={styles.panel} style={{marginTop:22}} aria-labelledby="replacement-heading">
  <p className={styles.kicker}>07C / VERVANGING MET BRONBEWIJS</p>
  <h2 id="replacement-heading">Correctiefactuur koppelen</h2>
  <p className={styles.hint}>Registratie volgt pas nadat de vervangende leveranciersfactuur als eigen dossier met document is goedgekeurd. De oude kostenpost blijft met haar geschiedenis intact en wordt niet opnieuw geteld.</p>
  {!enabled?<p role="alert" className={styles.error}>Vervangingsregister niet volledig beschikbaar. Koppelen is geblokkeerd.</p>:
   relevant.length===0?<p className={styles.hint}>Nog geen correctieverzoeken waarbij een vervangende factuur noodzakelijk is.</p>:
   relevant.map(c=><div key={c.id} style={{borderTop:"1px solid #66553c",paddingTop:12,marginTop:12}}>
    {linked.has(c.id)?<p className={styles.hint}>Correctie {c.id.slice(0,8)} gekoppeld aan factuurdossier {linked.get(c.id)!.replacement_draft_id.slice(0,8)}.</p>:
     <ReplacementForm correction={c} drafts={drafts} reviewed={reviewed} documentIds={documented}/>}
   </div>)}
 </section>;
}
