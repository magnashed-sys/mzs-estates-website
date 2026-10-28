"use client";
import {initialFormActionState} from "../../../../../lib/property-operations/form-state";

import {useActionState} from "react";
import {savePropertyExpenseDraft} from "./expense-draft-actions";
import styles from "./expenses.module.css";

export type PayerLink={property_id:string;legal_entity_id:string;effective_from:string;effective_until:string|null};
export type DraftSelection={
  propertyId:string;entityId:string;supplierId:string;invoiceNumber:string;
  invoiceDate:string;category:string;description:string;netCents:number;vatCents:number;
  allocation:{targetId:string;netCents:number;vatCents:number}[];
};

export default function ExpenseDraftSaver({
 selection,payerLinks,available,enabled
}:{selection:DraftSelection|null;payerLinks:PayerLink[];available:boolean;enabled:boolean}){
 const [state,action,pending]=useActionState(savePropertyExpenseDraft,initialFormActionState);
 const linked=selection!==null && payerLinks.some(l=>
   l.property_id===selection.propertyId&&l.legal_entity_id===selection.entityId&&
   l.effective_from<=selection.invoiceDate&&
   (l.effective_until===null||l.effective_until>=selection.invoiceDate)
 );
 const canSave=Boolean(enabled&&available&&selection&&linked&&!pending);
 const allocations=selection?.allocation.map(r=>({
   unit_id:r.targetId===selection.propertyId?null:r.targetId,
   net_cents:r.netCents,vat_cents:r.vatCents
 }))??[];
 return <div className={styles.blocked}>
  <strong>Conceptregistratie (alleen Staging)</strong>
  <p>Een kostenconcept is nog geen goedgekeurde inkoopfactuur. Het originele leveranciersdocument, de betaling en eventuele doorbelasting worden in een volgende fase verwerkt.</p>
  {!linked&&selection&&<p role="status">Koppel eerst de geselecteerde juridische entiteit als <strong>kostendrager / betaler</strong> aan dit object met een ingangsdatum op of vóór de factuurdatum.</p>}
  {!available&&<p role="alert">De Staging-databasetabel voor conceptkosten is niet beschikbaar of niet volledig gelezen.</p>}
  <form action={action} className={styles.draftSaveForm}>
   <input type="hidden" name="property_id" value={selection?.propertyId??""}/>
   <input type="hidden" name="legal_entity_id" value={selection?.entityId??""}/>
   <input type="hidden" name="supplier_relationship_id" value={selection?.supplierId??""}/>
   <input type="hidden" name="supplier_invoice_number" value={selection?.invoiceNumber??""}/>
   <input type="hidden" name="invoice_date" value={selection?.invoiceDate??""}/>
   <input type="hidden" name="category" value={selection?.category??""}/>
   <input type="hidden" name="description" value={selection?.description??""}/>
   <input type="hidden" name="net_cents" value={selection?.netCents??0}/>
   <input type="hidden" name="vat_cents" value={selection?.vatCents??0}/>
   <input type="hidden" name="allocations" value={JSON.stringify(allocations)}/>
   <button className={styles.saveButton} disabled={!canSave} type="submit">
    {pending?"Concept opslaan…":"Bewaar inkoopkosten als concept op Staging"}
   </button>
   {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.hint}>{state.message}</p>}
  </form>
 </div>;
}
