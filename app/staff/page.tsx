import {requirePropertyStaff} from "../../lib/security/property-staff";
import StaffForms from "./StaffForms";
import s from "./staff.module.css";
export const dynamic="force-dynamic";
export default async function StaffPortalPage(){
 const {db,user,properties}=await requirePropertyStaff();
 const [u,v,t]=await Promise.all([
  db.from("mzs_ops_staff_unit_directory").select("id,property_id,address",{count:"exact"}).order("address").limit(500),
  db.from("mzs_ops_staff_visits").select("id,property_id,worked_on,actual_minutes,task_category,description",{count:"exact"})
   .eq("profile_id",user.id).order("worked_on",{ascending:false}).limit(100),
  db.from("mzs_ops_maintenance_tickets").select("id,property_id,priority,title,status,created_at",{count:"exact"})
   .eq("reported_by",user.id).order("created_at",{ascending:false}).limit(100)
 ]);
 const complete=[u,v,t].every(x=>!x.error&&x.count!==null&&x.data!==null&&x.count===x.data.length);
 const name=(id:string)=>properties.find(p=>p.id===id)?.name??"Object";
 return <main className={s.main}>
  <header className={s.head}>
   <p className={s.kicker}>MZS GROUP / STAFF OPERATIONS / STAGING</p>
   <h1>Mijn werkzaamheden</h1>
   <p>Werkelijke werktijd en onderhoud melden, uitsluitend voor aan jou toegewezen vastgoedobjecten.</p>
  </header>
  <div className={s.note}><strong>Afgeschermde testomgeving.</strong> Dit portaal toont geen andere medewerkers, klanten, facturen, commerciële tarieven of kapitaaldossiers. Een werkbezoek is geen doorfacturatie.</div>
  {!complete?<p role="alert" className={s.error}>Eén of meer registers zijn niet volledig beschikbaar. Invoer is geblokkeerd om verkeerde objecttoewijzingen te voorkomen.</p>:
   <>
    <StaffForms properties={properties} units={u.data!}/>
    <div className={s.history}>
     <section>
      <h2>Mijn recente werkbezoeken</h2>
      {v.data!.length===0?<p>Er zijn nog geen bezoeken geregistreerd.</p>:
       <div className={s.tableWrap}><table>
        <thead><tr><th>Datum</th><th>Object</th><th>Werk</th><th>Werkelijk</th></tr></thead>
        <tbody>{v.data!.map(x=><tr key={x.id}>
         <td>{x.worked_on}</td><td>{name(x.property_id)}</td><td>{x.task_category}</td><td>{x.actual_minutes} min</td>
        </tr>)}</tbody>
       </table></div>}
     </section>
     <section>
      <h2>Mijn onderhoudsmeldingen</h2>
      {t.data!.length===0?<p>Er zijn nog geen meldingen.</p>:
       <div className={s.tableWrap}><table>
        <thead><tr><th>Melding</th><th>Object</th><th>Urgentie</th><th>Status</th></tr></thead>
        <tbody>{t.data!.map(x=><tr key={x.id}>
         <td>{x.title}</td><td>{name(x.property_id)}</td><td>{x.priority}</td><td>{x.status}</td>
        </tr>)}</tbody>
       </table></div>}
     </section>
    </div>
   </>}
 </main>;
}
