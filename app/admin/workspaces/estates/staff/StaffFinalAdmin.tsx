import {initialFormActionState} from "../../../../../lib/property-operations/form-state";
"use client";
import {useActionState,useState} from "react";
import {
 decideStaffCorrection,createInternalWorkOrder,decideInternalWorkOrder
} from "./completion-actions";
import s from "../../../../staff/staff.module.css";

type Correction={id:string;visit_id:string;proposed_minutes:number;reason:string};
type CorrectionDecision={correction_id:string;decision:string};
type Visit={id:string;profile_id:string;actual_minutes:number};
type Ticket={id:string;property_id:string;title:string};
type Event={ticket_id:string;sequence_no:number;action:string};
type Issuer={id:string;name:string};
type Supplier={id:string;name:string};
type Link={property_id:string;legal_entity_id:string;relationship_type:string};
type WorkOrder={id:string;ticket_id:string;quotation_reference:string;approved_budget_net_cents:number|string;approved_budget_vat_cents:number|string};
type OrderDecision={work_order_id:string;decision:string};
type Photo={id:string;ticket_id:string};
const relevantState=new Set(["triaged","scheduled","in_progress"]);
const money=(x:FormDataEntryValue|null)=>{
 const value=String(x??"").trim().replace(",",".");
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(value))return "";
 const [euros,cents=""]=value.split(".");
 return String(Number(euros)*100+Number(cents.padEnd(2,"0")));
};
function CorrectionForm({correction,visit}:{correction:Correction;visit:Visit|undefined}){
 const [state,action,busy]=useActionState(decideStaffCorrection,initialFormActionState);
 return <form className={s.form} action={action}>
  <h2>Urenvoorstel beoordelen</h2>
  <p className={s.description}>Oorspronkelijk: {visit?.actual_minutes??"—"} minuten.
   Voorgesteld: {correction.proposed_minutes} minuten. Reden: {correction.reason}</p>
  <input type="hidden" name="correction_id" value={correction.id}/>
  <label>Beslissing<select name="decision" defaultValue="approved" required>
    <option value="approved">Correctie accepteren</option>
    <option value="rejected">Correctie afwijzen</option>
  </select></label>
  <label>Onderbouwing<textarea name="reason" minLength={8} maxLength={1000} rows={2} required/></label>
  <button disabled={busy} type="submit">{busy?"Controleren…":"Correctie beslissen"}</button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
  <p className={s.description}>Het origineel wordt niet aangepast. De urenreview volgt afzonderlijk.</p>
 </form>;
}
function WorkOrderForm({tickets,events,issuers,suppliers,links}:{tickets:Ticket[];events:Event[];
 issuers:Issuer[];suppliers:Supplier[];links:Link[]}){
 const [state,action,busy]=useActionState(createInternalWorkOrder,initialFormActionState);
 const [ticketId,setTicketId]=useState("");
 const [net,setNet]=useState("");
 const [vat,setVat]=useState("");
 const ticket=tickets.find(t=>t.id===ticketId);
 const latest=new Map<string,Event>();
 for(const e of events){const last=latest.get(e.ticket_id);if(!last||e.sequence_no>last.sequence_no)latest.set(e.ticket_id,e);}
 const eligible=tickets.filter(t=>relevantState.has(latest.get(t.id)?.action??"reported"));
 const allowed=issuers.filter(i=>links.some(l=>l.property_id===ticket?.property_id&&l.legal_entity_id===i.id&&l.relationship_type==="payer"));
 return <form className={s.form} action={action}>
  <h2>Interne werkopdracht voorbereiden</h2>
  <p className={s.description}>Een concept voor begroting en interne toestemming. Geen automatische leverancierstoewijzing of externe verzending.</p>
  <label>Beoordeelde onderhoudsmelding<select required name="ticket_id" value={ticketId} onChange={e=>setTicketId(e.target.value)}>
   <option value="">Kies beoordeelde melding</option>
   {eligible.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
  </select></label>
  <label>Geverifieerde kostendrager<select key={ticketId} required name="legal_entity_id" defaultValue="">
   <option value="">Kies juridische entiteit</option>
   {allowed.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
  </select></label>
  <label>Leverancier<select required name="supplier_relationship_id" defaultValue="">
   <option value="">Kies leverancier of relatie</option>
   {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
  </select></label>
  <label>Omschrijving werkzaamheden<textarea name="scope_of_work" rows={3} minLength={10} maxLength={2000} required/></label>
  <label>Offerte- of interne referentie<input name="quotation_reference" minLength={3} maxLength={180} required/></label>
  <div className={s.two}>
   <label>Begroting excl. btw (€)<input value={net} onChange={e=>setNet(e.target.value)} inputMode="decimal" required/></label>
   <label>Btw zoals beoordeeld (€)<input value={vat} onChange={e=>setVat(e.target.value)} inputMode="decimal" required/></label>
  </div>
  <input type="hidden" name="approved_budget_net_cents" value={money(net)}/>
  <input type="hidden" name="approved_budget_vat_cents" value={money(vat)}/>
  <button type="submit" disabled={busy||!ticketId||!allowed.length||!money(net)||!money(vat)}>
    {busy?"Concept bewaren…":"Interne conceptwerkopdracht opslaan"}
  </button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
 </form>;
}
function OrderDecisionForm({order}:{order:WorkOrder}){
 const [state,action,busy]=useActionState(decideInternalWorkOrder,initialFormActionState);
 return <form className={s.form} action={action}>
  <h2>Werkopdracht intern beoordelen</h2>
  <p className={s.description}>Offerte {order.quotation_reference}. Begroting:
    € {(Number(order.approved_budget_net_cents)+Number(order.approved_budget_vat_cents))/100} incl. opgegeven btw.</p>
  <input type="hidden" name="work_order_id" value={order.id}/>
  <label>Beslissing<select required name="decision" defaultValue="authorized_internally">
   <option value="authorized_internally">Intern budget autoriseren</option>
   <option value="declined">Concept afwijzen</option>
  </select></label>
  <label>Reden van beslissing<textarea name="reason" required rows={2} minLength={8} maxLength={1000}/></label>
  <button type="submit" disabled={busy}>{busy?"Vastleggen…":"Interne beslissing vastleggen"}</button>
  {state.message&&<p role="status" className={state.status==="error"?s.error:s.confirm}>{state.message}</p>}
 </form>;
}
export default function StaffFinalAdmin({
 corrections,correctionDecisions,visits,tickets,events,issuers,suppliers,links,orders,orderDecisions,photos
}:{
 corrections:Correction[];correctionDecisions:CorrectionDecision[];visits:Visit[];
 tickets:Ticket[];events:Event[];issuers:Issuer[];suppliers:Supplier[];links:Link[];
 orders:WorkOrder[];orderDecisions:OrderDecision[];photos:Photo[]
}){
 const decided=new Set(correctionDecisions.map(x=>x.correction_id));
 const orderDone=new Set(orderDecisions.map(x=>x.work_order_id));
 const outstanding=corrections.filter(x=>!decided.has(x.id));
 const awaiting=orders.filter(x=>!orderDone.has(x.id));
 return <section className={s.history}>
  <section>
   <h2>Correcties en fotobewijs</h2>
   <p className={s.description}>{corrections.length} correctievoorstellen; {outstanding.length} open.</p>
   {outstanding.map(c=><CorrectionForm key={c.id} correction={c} visit={visits.find(v=>v.id===c.visit_id)}/>)}
   <h2>Originele onderhoudsfoto's</h2>
   {photos.length===0?<p className={s.description}>Nog geen foto's geüpload.</p>:photos.slice(0,50).map(p=><p key={p.id} className={s.description}>
    <a href={"/api/staff/maintenance-photo/"+p.id} target="_blank" rel="noopener noreferrer">
     Beveiligde foto bij melding {p.ticket_id.slice(0,8)}
    </a>
   </p>)}
  </section>
  <section>
   <h2>Werkopdrachten</h2>
   <WorkOrderForm tickets={tickets} events={events} issuers={issuers} suppliers={suppliers} links={links}/>
   <p className={s.description}>{awaiting.length} conceptwerkopdracht(en) wachten op een interne beslissing.</p>
   {awaiting.slice(0,20).map(o=><OrderDecisionForm key={o.id} order={o}/>)}
  </section>
 </section>;
}
