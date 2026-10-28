import {initialFormActionState} from "../../../../../lib/property-operations/form-state";
"use client";
import {useActionState,useState} from "react";
import {reviewActualVisit,recordTicketProgress} from "./review-actions";
import s from "../../../../staff/staff.module.css";

type Visit={id:string;profile_id:string;property_id:string;worked_on:string;actual_minutes:number;task_category:string};
type VisitReview={id:string;visit_id:string;decision:string;recharge_class:string;billable_minutes:number};
type Ticket={id:string;reported_by:string;property_id:string;title:string;priority:string};
type TicketEvent={id:string;ticket_id:string;sequence_no:number;action:string;note:string};
const transitions:Record<string,string[]>={
 reported:["triaged"],
 triaged:["scheduled","in_progress","resolved"],
 scheduled:["in_progress","resolved"],
 in_progress:["resolved"],
 resolved:["reopened","closed"],
 reopened:["triaged","scheduled","in_progress","resolved"],
 closed:[]
};
const statusLabels:Record<string,string>={
 triaged:"Beoordeeld",scheduled:"Ingepland",in_progress:"In uitvoering",
 resolved:"Opgelost",reopened:"Opnieuw geopend",closed:"Afgesloten"
};
function VisitReviewForm({visit,name,propertyName,review}:{
 visit:Visit;name:string;propertyName:string;review:VisitReview|null
}){
 const [result,action,pending]=useActionState(reviewActualVisit,initialFormActionState);
 const [decision,setDecision]=useState("approved");
 const [className,setClassName]=useState("not_billable");
 if(review)return <div className={s.note}>
  <strong>{name}</strong> · {propertyName} · {visit.worked_on} · {visit.actual_minutes} werkelijk.
  <p>{review.decision==="approved"?"Goedgekeurd":"Afgewezen"} · {review.recharge_class==="review_candidate"?
    review.billable_minutes+" voorgestelde factureerbare minuten (niet gefactureerd)":"Geen doorbelasting"}</p>
 </div>;
 return <form action={action} className={s.form}>
  <h2>{name}</h2>
  <p className={s.description}>{propertyName} · {visit.worked_on} · {visit.task_category} · <strong>{visit.actual_minutes} werkelijk gewerkte minuten</strong></p>
  <input type="hidden" name="visit_id" value={visit.id}/>
  <label>Beslissing<select name="decision" value={decision} onChange={e=>{
   setDecision(e.target.value);if(e.target.value==="rejected")setClassName("not_billable");
  }}>
   <option value="approved">Goedkeuren</option>
   <option value="rejected">Afwijzen</option>
  </select></label>
  <label>Factureerbaarheid<select name="recharge_class" value={className} onChange={e=>setClassName(e.target.value)} disabled={decision==="rejected"}>
   <option value="not_billable">Niet doorbelasten</option>
   <option value="review_candidate">Ter beoordeling voor doorbelasting</option>
  </select></label>
  {decision==="rejected"&&<input type="hidden" name="recharge_class" value="not_billable"/>}
  {decision==="approved"&&className==="review_candidate"&&<div className={s.two}>
   <label>Minimum minuten (expliciete afspraak)
    <input name="minimum_minutes" type="number" min={0} max={960} step={1} required placeholder="Bijvoorbeeld 60"/>
   </label>
   <label>Afronden per aantal minuten
    <input name="increment_minutes" type="number" min={1} max={960} step={1} required placeholder="Bijvoorbeeld 60"/>
   </label>
  </div>}
  <label>Controle / reden<textarea name="reason" minLength={8} maxLength={1000} rows={2} required
   placeholder="Controleer bron, bezoek, object en eventuele factureerafspraak"/></label>
  <button disabled={pending} type="submit">{pending?"Beoordelen…":"Bezoek beoordelen op Staging"}</button>
  {result.message&&<p role="status" className={result.status==="error"?s.error:s.confirm}>{result.message}</p>}
  <p className={s.description}>Een goedgekeurde bezoekregistratie maakt geen loonbetaling of uitgaande factuur aan. Factureerbare minuten zijn een afzonderlijk voorstel.</p>
 </form>;
}
function TicketReviewForm({ticket,status,propertyName}:{
 ticket:Ticket;status:string;propertyName:string
}){
 const [result,submit,pending]=useActionState(recordTicketProgress,initialFormActionState);
 const available=transitions[status]??[];
 return <form className={s.form} action={submit}>
  <h2>{ticket.title}</h2>
  <p className={s.description}>{propertyName} · Prioriteit: {ticket.priority} · Huidige status: {statusLabels[status]??"Nieuw gemeld"}</p>
  <input name="ticket_id" type="hidden" value={ticket.id}/>
  {available.length?<label>Volgende stap
   <select required name="action" defaultValue="">
    <option value="" disabled>Selecteer een geldige vervolgstatus</option>
    {available.map(k=><option value={k} key={k}>{statusLabels[k]}</option>)}
   </select>
  </label>:<p className={s.description}>Deze melding is administratief afgesloten.</p>}
  {available.length>0&&<>
   <label>Opvolging / controle<textarea required name="note" rows={3} minLength={8} maxLength={2000}
    placeholder="Welke beoordeling of actie is uitgevoerd?"/></label>
   <label>Interne werkorderreferentie (optioneel)
    <input name="work_order_reference" minLength={3} maxLength={100}
     placeholder="Interne planning, geen externe opdracht"/>
   </label>
   <button type="submit" disabled={pending}>{pending?"Opslaan…":"Onderhoudsstatus bijwerken"}</button>
   {result.message&&<p role="status" className={result.status==="error"?s.error:s.confirm}>{result.message}</p>}
   <p className={s.description}>Een werkorderreferentie is alleen intern. Er wordt niets besteld, betaald of gefactureerd.</p>
  </>}
 </form>;
}
export default function StaffReviews({visits,reviews,tickets,events,members,properties}:{
 visits:Visit[];reviews:VisitReview[];tickets:Ticket[];events:TicketEvent[];
 members:Record<string,string>;properties:Record<string,string>
}){
 const byVisit=new Map(reviews.map(r=>[r.visit_id,r]));
 const latest=new Map<string,TicketEvent>();
 for(const e of events){const prev=latest.get(e.ticket_id);if(!prev||e.sequence_no>prev.sequence_no)latest.set(e.ticket_id,e);}
 return <div className={s.history}>
  <section>
   <h2>Werkbezoeken beoordelen</h2>
   {visits.length===0?<p>Er zijn nog geen werkbezoeken.</p>:
    <div style={{display:"grid",gap:14,marginTop:18}}>
     {visits.slice(0,30).map(v=><VisitReviewForm key={v.id} visit={v}
       review={byVisit.get(v.id)??null} name={members[v.profile_id]??"Medewerker"}
       propertyName={properties[v.property_id]??"Object"}/>)}
    </div>}
  </section>
  <section>
   <h2>Onderhoud opvolgen</h2>
   {tickets.length===0?<p>Er zijn nog geen meldingen.</p>:
    <div style={{display:"grid",gap:14,marginTop:18}}>
     {tickets.slice(0,30).map(t=><TicketReviewForm key={t.id} ticket={t}
       propertyName={properties[t.property_id]??"Object"} status={latest.get(t.id)?.action??"reported"}/>)}
    </div>}
  </section>
 </div>;
}
