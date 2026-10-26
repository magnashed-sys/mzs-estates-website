import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function EstatesWorkspace(){
 const {db}=await requireEstateAdmin();
 const [properties,units,contracts]=await Promise.all([
  db.from("mzs_estate_properties").select("id",{count:"exact",head:true}),
  db.from("mzs_estate_units").select("id",{count:"exact",head:true}),
  db.from("mzs_lease_contracts").select("id",{count:"exact",head:true})
 ]);
 const counts=[
  {label:"Registered properties",result:properties},
  {label:"Registered units",result:units},
  {label:"Rental contracts",result:contracts}
 ];
 const unavailable=counts.filter(x=>x.result.error||x.result.count===null);
 return <>
  <section className={styles.intro}>
   <p className={styles.kicker}>MZS ESTATES / PROPERTY COCKPIT</p>
   <h1 className={styles.heading}>Real estate management.</h1>
   <p className={styles.lead}>Property holdings, rentable units, rental contracts and booking workflows. Each register loads in its own dedicated administration route; no client-account or Capital dossier list is loaded here.</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">Some property counts could not be verified ({unavailable.map(x=>x.label).join(", ")}). No incomplete totals are presented for those sections.</p>}
  <section className={styles.stats} aria-label="Estates register counts">
   {counts.map(x=><div className={styles.stat} key={x.label}>
    <small>{x.label}</small><strong>{x.result.error||x.result.count===null?"Unavailable":x.result.count}</strong>
   </div>)}
  </section>
  <section className={styles.grid} aria-label="Property workflows">
   <Link className={styles.card} href="/admin/group/estates/properties"><small>01 / PROPERTY REGISTER</small><strong>Properties & ownership</strong><p>Legal ownership, managing agents and property records.</p><span>Open property register →</span></Link>
   <Link className={styles.card} href="/admin/group/estates/units"><small>02 / UNIT MANAGEMENT</small><strong>Rental units</strong><p>Rentable units, linked contracts and recorded rental amounts.</p><span>Open rental units →</span></Link>
   <Link className={styles.card} href="/admin/group/estates/contracts"><small>03 / RENTAL ADMINISTRATION</small><strong>Contracts & invoices</strong><p>Tenants, agreements, invoicing entities and billing control.</p><span>Open contracts →</span></Link>
   <Link className={styles.card} href="/admin/bookings"><small>04 / RESERVATIONS</small><strong>Bookings</strong><p>Current and historical bookings, private stays, year filters and payments.</p><span>Open Bookings →</span></Link>
   <Link className={styles.card} href="/admin/owner-stays"><small>05 / OWNER & PARTNER</small><strong>Owner stays</strong><p>Complimentary stays, availability checks and booking approval.</p><span>Manage owner stays →</span></Link>
   <Link className={styles.card} href="/admin?tab=projects"><small>06 / PROJECT PRESENTATIONS</small><strong>Projects & access</strong><p>Private listings, project materials and client permissions.</p><span>Manage projects →</span></Link>
  </section>
  <p className={styles.note}>Counts represent registered records, not monthly revenue or paid invoices. The financial cockpit provides separate reporting of contracted, forecast and actually received amounts.</p>
 </>;
}
