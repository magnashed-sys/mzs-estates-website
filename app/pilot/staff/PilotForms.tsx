"use client";
import {useActionState} from "react";
import {recordPilotVisit,recordPilotTicket,type PilotActionState} from "./actions";
import s from "./pilot.module.css";
const initial:PilotActionState={status:"idle",message:""};
export default function PilotForms(){
 const [visit,saveVisit,visitPending]=useActionState(recordPilotVisit,initial);
 const [ticket,saveTicket,ticketPending]=useActionState(recordPilotTicket,initial);
 return <div className={s.forms}>
  <section className={s.panel}>
   <h2>Testbezoek — werkelijke tijd</h2>
   <p>Registreer uitsluitend verzonnen voorbeeldgegevens. Dit is geen salaris- of factuurregistratie.</p>
   <form action={saveVisit}>
    <label>Datum<input type="date" name="worked_on" required/></label>
    <label>Werkelijke minuten<input type="number" name="actual_minutes" min="1" max="960" step="1" required/></label>
    <label>Voorbeeldomschrijving<textarea name="description" minLength={8} maxLength={1200} required placeholder="Voorbeeld: fictieve controle van hal en verlichting"/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_synthetic" value="yes" required/> Ik gebruik uitsluitend fictieve testgegevens.</label>
    <button type="submit" disabled={visitPending}>{visitPending?"Bezig...":"Testbezoek opslaan"}</button>
    {visit.message&&<p role={visit.status==="error"?"alert":"status"} aria-live="polite" className={visit.status==="error"?s.error:s.success}>{visit.message}</p>}
   </form>
  </section>
  <section className={s.panel}>
   <h2>Testmelding onderhoud</h2>
   <p>Geen externe opdracht, klantbericht, leverancierskosten of betalingshandeling.</p>
   <form action={saveTicket}>
    <label>Urgentie<select name="priority" defaultValue="routine" required>
     <option value="routine">Normaal</option><option value="soon">Binnenkort</option><option value="urgent">Spoed (alleen test)</option>
    </select></label>
    <label>Voorbeeldtitel<input name="title" minLength={5} maxLength={120} required placeholder="Fictieve lamp defect"/></label>
    <label>Voorbeeldomschrijving<textarea name="description" minLength={8} maxLength={1200} required placeholder="Voorbeeld: fictieve melding over een lamp"/></label>
    <label className={s.check}><input type="checkbox" name="confirmed_synthetic" value="yes" required/> Ik gebruik uitsluitend fictieve testgegevens.</label>
    <button type="submit" disabled={ticketPending}>{ticketPending?"Bezig...":"Testmelding opslaan"}</button>
    {ticket.message&&<p role={ticket.status==="error"?"alert":"status"} aria-live="polite" className={ticket.status==="error"?s.error:s.success}>{ticket.message}</p>}
   </form>
  </section>
 </div>;
}
