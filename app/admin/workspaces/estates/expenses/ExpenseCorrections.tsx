"use client";
import {useMemo,useState,useActionState} from "react";
import {inputEuroCents} from "../../../../../lib/property-operations/expense-preview";
import {proposeSupplierCostCorrection,initialCostCorrectionState} from "./correction-actions";
import styles from "./expenses.module.css";
type Source={
 id:string;supplier_invoice_number:string;description:string;
 property_id:string;net_cents:string|number;vat_cents:string|number;
 allocations:unknown
};
type Review={draft_id:string;sequence_no:number;action:string};
type Correction={draft_id:string};
function euro(cents:unknown){
 return (Number(cents)/100).toFixed(2).replace(".",",");
}
export default function ExpenseCorrections({
 drafts,events,requests,enabled
}:{drafts:Source[];events:Review[];requests:Correction[];enabled:boolean}){
 const [state,action,pending]=useActionState(proposeSupplierCostCorrection,initialCostCorrectionState);
 const [draftId,setDraftId]=useState("");
 const [description,setDescription]=useState("");
 const [net,setNet]=useState("");
 const [vat,setVat]=useState("");
 const latest=useMemo(()=>{
  const m=new Map<string,Review>();
  for(const x of events)if(!m.has(x.draft_id)||m.get(x.draft_id)!.sequence_no<x.sequence_no)m.set(x.draft_id,x);
  return m;
 },[events]);
 const existing=new Set(requests.map(x=>x.draft_id));
 const options=drafts.filter(d=>["approved","rejected"].includes(latest.get(d.id)?.action??"")&&!existing.has(d.id));
 const selected=options.find(d=>d.id===draftId);
 const proposed=useMemo(()=>{
  if(!selected)return null;
  try {
   const original=selected.allocations;
   if(!Array.isArray(original)||original.length!==1)throw Error("multi unit");
   const x=original[0] as {unit_id:unknown};
   if(!x||!((x.unit_id===null)||(typeof x.unit_id==="string")))throw Error("invalid unit");
   const n=inputEuroCents(net),v=inputEuroCents(vat);
   if(n+v<=0)throw Error("zero value");
   return {net:n,vat:v,allocations:[{unit_id:x.unit_id,net_cents:n,vat_cents:v}]};
  }catch{return null;}
 },[selected,net,vat]);
 return <section className={styles.panel} style={{marginTop:22}} aria-labelledby="corrections-title">
  <p className={styles.kicker}>07 / CORRECTIES MET CONTROLEHISTORIE</p>
  <h2 id="corrections-title">Een beoordeelde kostenpost corrigeren</h2>
  <p className={styles.hint}>Een correctievoorstel past het oorspronkelijke document of bedrag <strong>niet</strong> aan. De goedgekeurde kostenpost wordt in de proefexport als uitzondering behandeld totdat de correctie via een afzonderlijke vervangingsprocedure is afgehandeld.</p>
  {!enabled?<p role="alert" className={styles.error}>Correctieregister of controlehistorie is niet volledig beschikbaar. Corrigeren is uitgeschakeld.</p>:<>
   {requests.length>0&&<p className={styles.hint}>{requests.length} correctievoorstel(len) geregistreerd. Deze originele posten worden niet als definitieve inkoopfacturen in de proefexport meegenomen.</p>}
   {!options.length?<p className={styles.hint}>Geen beoordeelde posten beschikbaar die nog een correctievoorstel kunnen ontvangen.</p>:
   <form action={action} className={styles.fields} style={{marginTop:18}}>
    <label>Kies een eerder beoordeelde kostenpost
     <select value={draftId} onChange={e=>{
      const x=options.find(z=>z.id===e.target.value);
      setDraftId(e.target.value);setDescription(x?.description??"");
      setNet(x?euro(x.net_cents):"");setVat(x?euro(x.vat_cents):"");
     }}>
      <option value="">Selecteer een afgewezen of goedgekeurde post</option>
      {options.map(x=><option key={x.id} value={x.id}>{x.supplier_invoice_number} · {latest.get(x.id)?.action}</option>)}
     </select>
    </label>
    {selected&&<>
     <div className={styles.twoFields}>
      <label>Voorgesteld bedrag excl. btw (€)
       <input value={net} onChange={e=>setNet(e.target.value)} inputMode="decimal" required/>
      </label>
      <label>Voorgestelde btw (€)
       <input value={vat} onChange={e=>setVat(e.target.value)} inputMode="decimal" required/>
      </label>
     </div>
     <label>Nieuwe omschrijving
      <input value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} required/>
     </label>
     {Array.isArray(selected.allocations)&&selected.allocations.length===1?null:
       <p role="alert" className={styles.error}>Voor een kostenpost met meerdere unitverdelingen is eerst de uitgebreide correctie-editor nodig. Er kan hier nog geen voorstel worden ingediend.</p>}
     <label>Reden voor correctie
      <textarea name="reason" required minLength={10} maxLength={1000} rows={3} placeholder="Vermeld de gecontroleerde aanleiding en de gewenste correctie"/>
     </label>
     <input type="hidden" name="draft_id" value={draftId}/>
     <input type="hidden" name="description" value={description}/>
     <input type="hidden" name="net_cents" value={proposed?.net??""}/>
     <input type="hidden" name="vat_cents" value={proposed?.vat??""}/>
     <input type="hidden" name="allocations" value={JSON.stringify(proposed?.allocations??[])}/>
     <button className={styles.saveButton} type="submit" disabled={!proposed||pending}>
      {pending?"Controleren…":"Correctievoorstel registreren op Staging"}
     </button>
    </>}
    {state.message&&<p className={state.status==="error"?styles.error:styles.hint} role="status">{state.message}</p>}
   </form>}
  </>}
 </section>;
}
