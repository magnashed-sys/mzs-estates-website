
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import {notFound} from "next/navigation";
import {requireOpsPilotAdmin} from "../../../lib/security/property-ops-pilot";
import PilotAdminForms from "./PilotAdminForms";
import s from "../../pilot/staff/pilot.module.css";
export const dynamic="force-dynamic";

/** Private pilot scope administration; remains entirely absent with default-OFF server flags. */
export default async function PropertyOpsPilotAdminPage(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

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
 const memberNames=new Map((members.data??[]).map(x=>[x.id,x.full_name??"Unknown name"]));
 const propertyNames=new Map((properties.data??[]).map(x=>[x.id,x.name]));
 const runProperty=new Map((runs.data??[]).map(x=>[x.id,x.property_id]));
 const formatTimestamp=(value:string)=>new Date(value).toLocaleString(adminLocale,{
  timeZone:"Europe/Madrid",day:"2-digit",month:"short",year:"numeric",
  hour:"2-digit",minute:"2-digit"
 });
 const dateOnly=(value:string)=>new Date(value+"T12:00:00Z").toLocaleDateString(adminLocale,{
  timeZone:"Europe/Madrid",day:"2-digit",month:"short",year:"numeric"
 });
 const priorityLabel:Record<string,string>={routine:"Regulier",soon:"Binnenkort",urgent:"Urgent"};
 return <main className={s.main}>
  <header className={s.header}>
   <p className={s.eyebrow}>{adminT("MZS GROUP / GROUP ADMIN / ISOLATED PILOT")}</p>
   <h1>{adminT("Property Operations Pilot")}</h1>
   <p className={s.lead}>{adminT("Synthetic time entries and maintenance reports only. Each pilot starts OFF and cannot be reactivated after stopping.")}</p>
   <div className={s.badge}>{adminT("ISOLATED — NO REAL BILLING")}</div>
  </header>
  <section className={s.panel}>
   <h2>{adminT("Control overview")}</h2>
   <p>{adminT("Pilot runs:")} <strong>{runs.count}</strong>  {adminT("· Test visits:")} <strong>{visits.count}</strong>  {adminT("· Test reports:")} <strong>{tickets.count}</strong></p>
   <p>{adminT("These counts come only from the separate pilot tables, excluding existing rental, booking and capital records.")}</p>
   <p>{adminT("Active staff:")} <strong>{active.length}</strong></p>
   <ul>{active.map(e=><li key={e.run_id+"|"+e.profile_id}>
    <strong>{memberNames.get(e.profile_id)??adminT("Existing relationship")}</strong>
    <span>{propertyNames.get(runProperty.get(e.run_id)??"")??adminT("Property")}</span>
   </li>)}</ul>
  </section>
  <div className={s.historyGrid} aria-label={adminT("Recorded pilot activities")}>
   <section className={s.panel} aria-labelledby="pilot-visits-heading">
    <h2 id="pilot-visits-heading">{adminT("Work visits (")}{visits.count})</h2>
    <p className={s.historyHint}>{adminT("Latest")} {visits.data!.length}  {adminT("of")} {visits.count}  {adminT("visits. Synthetic pilot data only.")}</p>
    {visits.data!.length===0?<p>{adminT("No work visits have been recorded yet.")}</p>:(
     <ul className={s.historyList}>{visits.data!.map(visit=>
      <li className={s.historyItem} key={visit.id}>
       <div className={s.historyTop}><strong>{memberNames.get(visit.submitted_by)??adminT("Unknown staff member")}</strong>
        <span>{formatTimestamp(visit.created_at)}</span></div>
       <p><strong>{adminT("Property:")}</strong> {propertyNames.get(visit.property_id)??adminT("Unknown property")}</p>
       <p><strong>{adminT("Completed:")}</strong> {dateOnly(visit.worked_on)} · <strong>{visit.actual_minutes}  {adminT("minutes")}</strong></p>
       <p className={s.historyDescription}>{visit.description}</p>
      </li>)}</ul>
    )}
   </section>
   <section className={s.panel} aria-labelledby="pilot-tickets-heading">
    <h2 id="pilot-tickets-heading">{adminT("Maintenance reports (")}{tickets.count})</h2>
    <p className={s.historyHint}>{adminT("Latest")} {tickets.data!.length}  {adminT("of")} {tickets.count}  {adminT("reports. No external work orders.")}</p>
    {tickets.data!.length===0?<p>{adminT("No maintenance reports have been recorded yet.")}</p>:(
     <ul className={s.historyList}>{tickets.data!.map(ticket=>
      <li className={s.historyItem} key={ticket.id}>
       <div className={s.historyTop}><strong>{ticket.title}</strong>
        <span>{priorityLabel[ticket.priority]??adminT("Unknown")} · {formatTimestamp(ticket.created_at)}</span></div>
       <p><strong>{adminT("Submitted by:")}</strong> {memberNames.get(ticket.reported_by)??adminT("Unknown staff member")}</p>
       <p><strong>{adminT("Property:")}</strong> {propertyNames.get(ticket.property_id)??adminT("Unknown property")}</p>
       <p className={s.historyDescription}>{ticket.description}</p>
      </li>)}</ul>
    )}
   </section>
  </div>
  <PilotAdminForms
   runs={(runs.data??[]).map(r=>({id:r.id,property_id:r.property_id,
    status:latestRun.get(r.id)==="activate"?"active":latestRun.get(r.id)==="deactivate"?"definitief gestopt":"off"}))}
   properties={properties.data??[]}
   members={(members.data??[]).filter(member=>member.is_active===true)}
  />
 </main>;
}
