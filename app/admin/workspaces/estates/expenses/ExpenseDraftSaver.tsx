"use client";

import {useActionState} from "react";
import {savePropertyExpenseDraft,type ExpenseDraftState} from "./expense-draft-actions";
const initialFormActionState:ExpenseDraftState={status:"idle",message:""};
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
  <strong>Draft record — MZS Group</strong>
  <p>An expense draft is not yet an approved supplier invoice. The original supplier document, payment and any recharge will be processed in a later phase.</p>
  {!linked&&selection&&<p role="status">First associate the selected legal entity as <strong>cost bearer / payer</strong> to this property with an effective date on or before the invoice date.</p>}
  {!available&&<p role="alert">The expense draft register is unavailable or was not fully loaded.</p>}
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
   <label className={styles.approvalLine}><input type="checkbox" name="confirmed_real_draft" value="yes" required/> I have checked the cost-bearing entity, invoice date, supplier and amounts. This is an immutable expense draft, not a final invoice.</label>
   <button className={styles.saveButton} disabled={!canSave} type="submit">
    {pending?"Saving draft…":"Save purchase expenses as a draft"}
   </button>
   {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.hint}>{state.message}</p>}
  </form>
 </div>;
}
