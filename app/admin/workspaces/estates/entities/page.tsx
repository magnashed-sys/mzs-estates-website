import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
import EntityLinkForm from "./EntityLinkForm";
import styles from "./entities.module.css";
export const dynamic="force-dynamic";

const prod="https://ptrnjzmcehrhbsfxntgw.supabase.co";
const stage="https://senonkpxdtlhyhrubicg.supabase.co";
export default async function PropertyEntityAttributionPage(){
 // Never read Production data through a Vercel Preview or local build.
 const allowed=(process.env.VERCEL_ENV==="production"&&process.env.NEXT_PUBLIC_SUPABASE_URL===prod)||
  (process.env.VERCEL_ENV==="preview"&&process.env.NEXT_PUBLIC_SUPABASE_URL===stage);
 if(!allowed)notFound();
 const {db}=await requireEstateAdmin();
 const [properties,issuers,links]=await Promise.all([
  db.from("mzs_estate_properties").select("id,name",{count:"exact"}).order("name").limit(200),
  db.from("mzs_lease_issuers").select("id,name",{count:"exact"}).order("name").limit(200),
  db.from("mzs_ops_property_entity_links")
   .select("id,property_id,legal_entity_id,relationship_type,effective_from,effective_until,evidence_reference,verified_at",
    {count:"exact"}).order("verified_at",{ascending:false}).limit(200)
 ]);
 if([properties,issuers,links].some(x=>x.error||x.count===null||x.data===null||x.data.length!==x.count))notFound();
 const p=properties.data??[];
 const e=issuers.data??[];
 const existing=links.data??[];
 const propertyName=new Map(p.map(v=>[v.id,v.name]));
 const entityName=new Map(e.map(v=>[v.id,v.name]));
 const relationshipLabels:Record<string,string>={
  owner:"Juridische eigenaar",payer:"Kostendrager / betaler",manager:"Beheerder"
 };
 const date=(value:string)=>new Date(value+"T12:00:00Z").toLocaleDateString("nl-NL",{timeZone:"Europe/Madrid"});
 return <main className={styles.main}>
  <Link href="/admin/workspaces/estates" className={styles.back}>Terug naar Estates</Link>
  <header className={styles.header}>
   <p className={styles.kicker}>MZS GROUP / ESTATES / INTERNE CONTROLE</p>
   <h1>Objecten &amp; juridische entiteiten</h1>
   <p>Registreer welke juridische entiteit eigenaar, kostendrager of beheerder is van een fysiek vastgoedobject.
    Iedere koppeling heeft een ingangsdatum en gecontroleerde bewijsbron.</p>
   <p className={styles.emphasis}>Dit is een administratieve toerekening — geen nieuwe factuur,
    betaling, fiscale vaststelling of automatische eigendomsoverdracht.</p>
  </header>
  <section className={styles.panel}>
   <h2>Geverifieerde koppelingen ({links.count})</h2>
   {existing.length===0?<p>Er zijn nog geen juridische objectkoppelingen geregistreerd.
    Selecteer hieronder pas een entiteit wanneer je de onderbouwing hebt gecontroleerd.</p>:
    <div className={styles.scroll} role="region" tabIndex={0} aria-label="Juridische objectkoppelingen">
     <table>
      <thead><tr><th>Object</th><th>Juridische entiteit</th><th>Relatie</th><th>Geldig vanaf</th>
       <th>Geldig tot</th><th>Bewijsbron</th></tr></thead>
      <tbody>{existing.map(link=><tr key={link.id}>
       <td>{propertyName.get(link.property_id)??"Onbekend object"}</td>
       <td>{entityName.get(link.legal_entity_id)??"Onbekende entiteit"}</td>
       <td>{relationshipLabels[link.relationship_type]??"Onbekende relatie"}</td>
       <td>{date(link.effective_from)}</td>
       <td>{link.effective_until?date(link.effective_until):"—"}</td>
       <td>{link.evidence_reference}</td>
      </tr>)}</tbody>
     </table>
    </div>
   }
  </section>
  <EntityLinkForm properties={p} issuers={e}/>
 </main>;
}
