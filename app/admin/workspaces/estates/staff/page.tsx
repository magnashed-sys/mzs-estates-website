import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
import StaffScopeForm from "./StaffScopeForm";
import StaffReviews from "./StaffReviews";
import StaffFinalAdmin from "./StaffFinalAdmin";
import s from "../../../../staff/staff.module.css";
export const dynamic="force-dynamic";
export default async function AdminStaffOperations(){
  // Direct URL access must fail closed before any Production data query.
  if(process.env.VERCEL_ENV!=="preview" ||
     process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
    notFound();
 const {db}=await requireEstateAdmin();
 const results=await Promise.all([
  db.from("profiles").select("id,full_name,role,is_active",{count:"exact"}).eq("is_active",true).in("role",["client","partner"]).order("full_name").limit(500),
  db.from("mzs_estate_properties").select("id,name",{count:"exact"}).order("name").limit(500),
  db.from("mzs_ops_staff_scope_events").select("id,sequence_no,profile_id,property_id,action,reason,created_at",{count:"exact"}).order("sequence_no",{ascending:false}).limit(1000),
  db.from("mzs_ops_staff_visits").select("id,profile_id,property_id,worked_on,actual_minutes,task_category",{count:"exact"}).order("created_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_maintenance_tickets").select("id,reported_by,property_id,title,priority,status,created_at",{count:"exact"}).order("created_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_visit_reviews").select("id,visit_id,decision,recharge_class,billable_minutes",{count:"exact"}).order("reviewed_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_maintenance_events").select("id,ticket_id,sequence_no,action,note",{count:"exact"}).order("sequence_no",{ascending:false}).limit(1000),
  db.from("mzs_ops_visit_correction_requests").select("id,visit_id,proposed_minutes,reason",{count:"exact"}).order("created_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_visit_correction_decisions").select("id,correction_id,decision",{count:"exact"}).order("decided_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_maintenance_work_orders").select("id,ticket_id,quotation_reference,approved_budget_net_cents,approved_budget_vat_cents",{count:"exact"}).order("created_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_maintenance_work_order_decisions").select("id,work_order_id,decision",{count:"exact"}).order("decided_at",{ascending:false}).limit(1000),
  db.from("mzs_ops_maintenance_photos").select("id,ticket_id",{count:"exact"}).order("created_at",{ascending:false}).limit(1000),
  db.from("mzs_lease_issuers").select("id,name",{count:"exact"}).order("name").limit(500),
  db.from("mzs_lease_relationships").select("id,name",{count:"exact"}).order("name").limit(500),
  db.from("mzs_ops_property_entity_links").select("id,property_id,legal_entity_id,relationship_type",{count:"exact"}).limit(1000)
 ]);
 const ok=results.every(x=>!x.error&&x.count!==null&&x.data!==null&&x.data.length===x.count);
 const [
  profiles,properties,events,visits,tickets,visitReviews,maintenanceEvents,
  corrections,decisions,orders,orderDecisions,photos,issuers,suppliers,payers
 ]=results;
 const names=new Map((profiles.data??[]).map(x=>[x.id,x.full_name??"Onbekend account"]));
 const propertyName=new Map((properties.data??[]).map(x=>[x.id,x.name]));
 const latest=new Map<string,{profile_id:string;property_id:string;action:string;reason:string}>();
 if(ok)for(const event of events.data??[]){
  const key=event.profile_id+"|"+event.property_id;
  if(!latest.has(key))latest.set(key,event);
 }
 const active=[...latest.values()].filter(x=>x.action==="grant");
 return <main className={s.main}>
  <Link href="/admin/workspaces/estates">← Terug naar Estates</Link>
  <header className={s.head}>
   <p className={s.kicker}>MZS GROUP / PROPERTY OPERATIONS / STAGING</p>
   <h1>Staff &amp; Maintenance</h1>
   <p>Medewerkersrechten, werkelijk geregistreerde werkbezoeken en onderhoudsmeldingen per vastgoedobject.</p>
  </header>
  <div className={s.note}>
   <strong>Geen automatisch personeelsaccount.</strong> Bestaande cliënt- en partnerrollen blijven intact.
   Een medewerker krijgt alleen toegang na een expliciete, controleerbare objecttoewijzing.
   Dit beheerscherm werkt uitsluitend met Staging-profielen; Production-accounts worden niet gekopieerd.
  </div>
  {!ok?<p className={s.error} role="alert">Een register is onvolledig of niet beschikbaar. Toewijzingen en totalen worden uit veiligheid niet weergegeven.</p>:
   <>
    <div className={s.forms}>
     <StaffScopeForm members={profiles.data!} properties={properties.data!}/>
     <section className={s.form}>
      <h2>Actieve objecttoewijzingen</h2>
      <p className={s.description}>De laatste gecontroleerde gebeurtenis bepaalt de toegang. Ingetrokken toegang verschijnt hier niet meer als actief.</p>
      {active.length===0?<p className={s.description}>Nog geen medewerkers per object toegewezen op Staging.</p>:
       <div className={s.tableWrap}><table>
        <thead><tr><th>Relatie</th><th>Object</th></tr></thead>
        <tbody>{active.map(x=><tr key={x.profile_id+"|"+x.property_id}>
         <td>{names.get(x.profile_id)??"Onbekende relatie"}</td>
         <td>{propertyName.get(x.property_id)??"Onbekend object"}</td>
        </tr>)}</tbody>
       </table></div>}
     </section>
    </div>
    <div className={s.history}>
     <section><h2>Geregistreerde bezoeken ({visits.count})</h2>
      {(visits.data??[]).length===0?<p>Nog geen werkbezoeken op Staging.</p>:
       <div className={s.tableWrap}><table>
        <thead><tr><th>Medewerker</th><th>Object</th><th>Datum</th><th>Werkelijke minuten</th></tr></thead>
        <tbody>{visits.data!.map(x=><tr key={x.id}>
         <td>{names.get(x.profile_id)??"Account"}</td><td>{propertyName.get(x.property_id)??"Object"}</td>
         <td>{x.worked_on}</td><td>{x.actual_minutes}</td>
        </tr>)}</tbody>
       </table></div>}
     </section>
     <section><h2>Onderhoudsmeldingen ({tickets.count})</h2>
      {(tickets.data??[]).length===0?<p>Nog geen onderhoudsmeldingen op Staging.</p>:
       <div className={s.tableWrap}><table>
        <thead><tr><th>Object</th><th>Onderwerp</th><th>Urgentie</th><th>Status</th></tr></thead>
        <tbody>{tickets.data!.map(x=><tr key={x.id}>
         <td>{propertyName.get(x.property_id)??"Object"}</td><td>{x.title}</td><td>{x.priority}</td><td>{x.status}</td>
        </tr>)}</tbody>
       </table></div>}
     </section>
    </div>
    <StaffReviews
      visits={visits.data!}
      reviews={visitReviews.data!}
      tickets={tickets.data!}
      events={maintenanceEvents.data!}
      members={Object.fromEntries(names)}
      properties={Object.fromEntries(propertyName)}
    />
    <StaffFinalAdmin
      corrections={corrections.data!}
      correctionDecisions={decisions.data!}
      visits={visits.data!}
      tickets={tickets.data!}
      events={maintenanceEvents.data!}
      issuers={issuers.data!}
      suppliers={suppliers.data!}
      links={payers.data!}
      orders={orders.data!}
      orderDecisions={orderDecisions.data!}
      photos={photos.data!}
    />
   </>}
 </main>;
}
