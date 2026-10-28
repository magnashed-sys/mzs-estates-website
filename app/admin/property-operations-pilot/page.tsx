import {notFound} from "next/navigation";
import {requireOpsPilotAdmin} from "../../../lib/security/property-ops-pilot";
import PilotAdminForms from "./PilotAdminForms";
import s from "../../pilot/staff/pilot.module.css";
export const dynamic="force-dynamic";

/** Private pilot scope administration; remains entirely absent with default-OFF server flags. */
export default async function PropertyOpsPilotAdminPage(){
 const {db}=await requireOpsPilotAdmin();
 const [properties,members,runs,runEvents,accessEvents,visits,tickets]=await Promise.all([
  db.from("mzs_estate_properties").select("id,name",{count:"exact"}).order("name").limit(200),
  db.from("profiles").select("id,full_name,role,is_active",{count:"exact"})
   .in("role",["client","partner"]).order("full_name").limit(300),
  db.from("mzs_ops_pilot_runs").select("id,property_id,purpose,created_at",{count:"exact"})
   .order("created_at",{ascending:false}).limit(100),
  db.from("mzs_ops_pilot_run_events").select("run_id,action,sequence_no",{count:"exact"})
   .order("sequence_no",{ascending:false}).limit(300),
  db.from("mzs_ops_pilot_access_events").select("run_id,profile_id,action,sequence_no",{count:"exact"})
   .order("sequence_no",{ascending:false}).limit(300),
  db.from("mzs_ops_pilot_visits")
   .select("id,run_id,property_id,submitted_by,worked_on,actual_minutes,description,created_at",{count:"exact"})
   .order("created_at",{ascending:false}).limit(50),
  db.from("mzs_ops_pilot_tickets")
   .select("id,run_id,property_id,reported_by,priority,title,description,created_at",{count:"exact"})
   .order("created_at",{ascending:false}).limit(50)
 ]);
 const complete=[properties,members,runs,runEvents,accessEvents].every(x=>
  !x.error&&x.count!==null&&x.data!==null&&x.count===x.data.length);
 // Recent records are intentionally bounded. Their count reports the full register,
 // but a truncated history must be labelled honestly, not treated as missing data.
 const historiesValid=[visits,tickets].every(x=>
  !x.error&&x.count!==null&&x.data!==null&&
  x.data.length<=50&&x.count>=x.data.length&&
  (x.count<=50?x.count===x.data.length:x.data.length===50));
 if(!complete||!historiesValid)notFound();
 const latestRun=new Map<string,string>();
 for(const e of runEvents.data??[])if(!latestRun.has(e.run_id))latestRun.set(e.run_id,e.action);
 const latestScope=new Map<string,{run_id:string;profile_id:string;action:string}>();
 for(const e of accessEvents.data??[]){
  const key=e.run_id+"|"+e.profile_id;
  if(!latestScope.has(key))latestScope.set(key,e);
 }
 const active=[...latestScope.values()].filter(e=>
  e.action==="grant"&&latestRun.get(e.run_id)==="activate");
 const memberNames=new Map((members.data??[]).map(x=>[x.id,x.full_name??"Naam onbekend"]));
 const propertyNames=new Map((properties.data??[]).map(x=>[x.id,x.name]));
 const runProperty=new Map((runs.data??[]).map(x=>[x.id,x.property_id]));
 const formatTimestamp=(value:string)=>new Date(value).toLocaleString("nl-NL",{
  timeZone:"Europe/Madrid",day:"2-digit",month:"short",year:"numeric",
  hour:"2-digit",minute:"2-digit"
 });
 const dateOnly=(value:string)=>new Date(value+"T12:00:00Z").toLocaleDateString("nl-NL",{
  timeZone:"Europe/Madrid",day:"2-digit",month:"short",year:"numeric"
 });
 const priorityLabel:Record<string,string>={routine:"Regulier",soon:"Binnenkort",urgent:"Urgent"};
 return <main className={s.main}>
  <header className={s.header}>
   <p className={s.eyebrow}>MZS GROUP / GROUP ADMIN / GESCHEIDEN PILOT</p>
   <h1>Property Operations Pilot</h1>
   <p className={s.lead}>Uitsluitend fictieve uren en onderhoudsmeldingen. Elke pilotrun begint UIT en wordt na stop nooit opnieuw geactiveerd.</p>
   <div className={s.badge}>AFGESCHERMD — GEEN ECHTE FACTURATIE</div>
  </header>
  <section className={s.panel}>
   <h2>Controleoverzicht</h2>
   <p>Pilotruns: <strong>{runs.count}</strong> · Testbezoeken: <strong>{visits.count}</strong> · Testmeldingen: <strong>{tickets.count}</strong></p>
   <p>Deze aantallen komen uitsluitend uit de gescheiden pilottabellen; geen bestaande huur-, boekings- of kapitaalregistraties.</p>
   <p>Actieve medewerkers: <strong>{active.length}</strong></p>
   <ul>{active.map(e=><li key={e.run_id+"|"+e.profile_id}>
    <strong>{memberNames.get(e.profile_id)??"Bestaande relatie"}</strong>
    <span>{propertyNames.get(runProperty.get(e.run_id)??"")??"Object"}</span>
   </li>)}</ul>
  </section>
  <div className={s.historyGrid} aria-label="Geregistreerde pilotactiviteiten">
   <section className={s.panel} aria-labelledby="pilot-visits-heading">
    <h2 id="pilot-visits-heading">Werkbezoeken ({visits.count})</h2>
    <p className={s.historyHint}>Laatste {visits.data!.length} van {visits.count} bezoeken. Alleen fictieve pilotgegevens.</p>
    {visits.data!.length===0?<p>Er zijn nog geen werkbezoeken geregistreerd.</p>:(
     <ul className={s.historyList}>{visits.data!.map(visit=>
      <li className={s.historyItem} key={visit.id}>
       <div className={s.historyTop}><strong>{memberNames.get(visit.submitted_by)??"Onbekende medewerker"}</strong>
        <span>{formatTimestamp(visit.created_at)}</span></div>
       <p><strong>Object:</strong> {propertyNames.get(visit.property_id)??"Onbekend object"}</p>
       <p><strong>Uitgevoerd:</strong> {dateOnly(visit.worked_on)} · <strong>{visit.actual_minutes} minuten</strong></p>
       <p className={s.historyDescription}>{visit.description}</p>
      </li>)}</ul>
    )}
   </section>
   <section className={s.panel} aria-labelledby="pilot-tickets-heading">
    <h2 id="pilot-tickets-heading">Onderhoudsmeldingen ({tickets.count})</h2>
    <p className={s.historyHint}>Laatste {tickets.data!.length} van {tickets.count} meldingen. Geen externe werkopdrachten.</p>
    {tickets.data!.length===0?<p>Er zijn nog geen onderhoudsmeldingen geregistreerd.</p>:(
     <ul className={s.historyList}>{tickets.data!.map(ticket=>
      <li className={s.historyItem} key={ticket.id}>
       <div className={s.historyTop}><strong>{ticket.title}</strong>
        <span>{priorityLabel[ticket.priority]??"Onbekend"} · {formatTimestamp(ticket.created_at)}</span></div>
       <p><strong>Ingediend door:</strong> {memberNames.get(ticket.reported_by)??"Onbekende medewerker"}</p>
       <p><strong>Object:</strong> {propertyNames.get(ticket.property_id)??"Onbekend object"}</p>
       <p className={s.historyDescription}>{ticket.description}</p>
      </li>)}</ul>
    )}
   </section>
  </div>
  <PilotAdminForms
   runs={(runs.data??[]).map(r=>({id:r.id,property_id:r.property_id,
    status:latestRun.get(r.id)==="activate"?"actief":latestRun.get(r.id)==="deactivate"?"definitief gestopt":"uit"}))}
   properties={properties.data??[]}
   members={(members.data??[]).filter(member=>member.is_active===true)}
  />
 </main>;
}
