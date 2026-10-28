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
  db.from("profiles").select("id,full_name,role",{count:"exact"}).eq("is_active",true)
   .in("role",["client","partner"]).order("full_name").limit(300),
  db.from("mzs_ops_pilot_runs").select("id,property_id,purpose,created_at",{count:"exact"})
   .order("created_at",{ascending:false}).limit(100),
  db.from("mzs_ops_pilot_run_events").select("run_id,action,sequence_no",{count:"exact"})
   .order("sequence_no",{ascending:false}).limit(300),
  db.from("mzs_ops_pilot_access_events").select("run_id,profile_id,action,sequence_no",{count:"exact"})
   .order("sequence_no",{ascending:false}).limit(300),
  db.from("mzs_ops_pilot_visits").select("id",{count:"exact",head:true}),
  db.from("mzs_ops_pilot_tickets").select("id",{count:"exact",head:true})
 ]);
 const complete=[properties,members,runs,runEvents,accessEvents].every(x=>
  !x.error&&x.count!==null&&x.data!==null&&x.count===x.data.length);
 if(!complete||visits.error||tickets.error||visits.count===null||tickets.count===null)notFound();
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
  <PilotAdminForms
   runs={(runs.data??[]).map(r=>({id:r.id,property_id:r.property_id,
    status:latestRun.get(r.id)==="activate"?"actief":latestRun.get(r.id)==="deactivate"?"definitief gestopt":"uit"}))}
   properties={properties.data??[]}
   members={members.data??[]}
  />
 </main>;
}
