import {notFound} from "next/navigation";
import {requireOpsPilotStaff} from "../../../lib/security/property-ops-pilot";
import PilotForms from "./PilotForms";
import s from "./pilot.module.css";
export const dynamic="force-dynamic";

/** The pilot is absent unless server flag, exact deployment, live account and DB grant all pass. */
export default async function PropertyOpsPilotStaffPage(){
 const {db,assignment}=await requireOpsPilotStaff();
 const [visits,tickets]=await Promise.all([
  db.from("mzs_ops_pilot_visits")
   .select("id,worked_on,actual_minutes,description,created_at",{count:"exact"})
   .eq("run_id",assignment.run_id).order("created_at",{ascending:false}).limit(100),
  db.from("mzs_ops_pilot_tickets")
   .select("id,priority,title,created_at",{count:"exact"})
   .eq("run_id",assignment.run_id).order("created_at",{ascending:false}).limit(100)
 ]);
 if(visits.error||tickets.error||!visits.data||!tickets.data||
   visits.count===null||tickets.count===null||
   visits.count!==visits.data.length||tickets.count!==tickets.data.length)notFound();
 return <main className={s.main}>
  <header className={s.header}>
   <p className={s.eyebrow}>MZS GROUP / AFGESCHERMDE PROEFPILOT</p>
   <h1>Medewerkers &amp; onderhoud</h1>
   <p className={s.lead}>Fictieve testgegevens · Geen echte facturatie, urenvergoeding, leveranciersopdracht of klantinformatie.</p>
   <div className={s.badge}>TESTGEGEVENS — PILOT</div>
  </header>
  <section className={s.panel}>
   <h2>Toegewezen object</h2>
   <p><strong>{assignment.property_name}</strong> — {assignment.property_address}</p>
   <p>Je ziet uitsluitend het object waarvoor je op dit moment expliciet bent gemachtigd.</p>
  </section>
  <PilotForms/>
  <section className={s.panel}>
   <h2>Mijn testbezoeken ({visits.count})</h2>
   {visits.data.length===0?<p>Er zijn nog geen testbezoeken geregistreerd.</p>:
    <ul>{visits.data.map(x=><li key={x.id}>
     <strong>{x.worked_on} · {x.actual_minutes} minuten</strong><span>{x.description}</span>
    </li>)}</ul>}
  </section>
  <section className={s.panel}>
   <h2>Mijn testmeldingen ({tickets.count})</h2>
   {tickets.data.length===0?<p>Er zijn nog geen testmeldingen geregistreerd.</p>:
    <ul>{tickets.data.map(x=><li key={x.id}><strong>{x.title}</strong><span>{x.priority}</span></li>)}</ul>}
  </section>
 </main>;
}
