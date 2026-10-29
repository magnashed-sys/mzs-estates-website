
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {Suspense} from "react";
import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import OperationsActionCenter from "../../OperationsActionCenter";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function EstatesWorkspace(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();
 const entityLinksAvailable=(process.env.VERCEL_ENV==="production" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL==="https://ptrnjzmcehrhbsfxntgw.supabase.co") ||
  (process.env.VERCEL_ENV==="preview" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL==="https://senonkpxdtlhyhrubicg.supabase.co");
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
   <p className={styles.kicker}>{adminT("MZS ESTATES / PROPERTY COCKPIT")}</p>
   <h1 className={styles.heading}>{adminT("Real Estate.")}</h1>
   <p className={styles.lead}>{adminT("Property holdings, rentable units, rental contracts and booking workflows. Each register loads in its own dedicated administration route; no client-account or Capital dossier list is loaded here.")}</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">{adminT("Some property counts could not be verified (")}{unavailable.map(x=>x.label).join(", ")}{adminT("). No incomplete totals are presented for those sections.")}</p>}
  <section className={styles.stats} aria-label={adminT("Estates register counts")}>
   {counts.map(x=><div className={styles.stat} key={x.label}>
    <small>{adminT(x.label)}</small><strong>{x.result.error||x.result.count===null?adminT("Unavailable"):x.result.count}</strong>
   </div>)}
  </section>
  <Suspense fallback={<p role="status">{adminT("Loading action list…")}</p>}><OperationsActionCenter db={db} scope="maintenance"/></Suspense>
  <section className={styles.grid} aria-label={adminT("Property workflows")}>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=triage"><small>{adminT("MAINTENANCE")}</small><strong>{adminT("Reports, planning & work orders")}</strong><p>{adminT("Follow up on maintenance, assigned staff, quotations and budget decisions.")}</p><span>{adminT("Open maintenance →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/properties"><small>{adminT("01 / PROPERTY REGISTER")}</small><strong>{adminT("Properties & ownership")}</strong><p>{adminT("Legal ownership, managing agents and property records.")}</p><span>{adminT("Open property register →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/units"><small>{adminT("02 / UNIT MANAGEMENT")}</small><strong>{adminT("Rental units")}</strong><p>{adminT("Rentable units, linked contracts and recorded rental amounts.")}</p><span>{adminT("Open rental units →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/contracts"><small>{adminT("03 / RENTAL ADMINISTRATION")}</small><strong>{adminT("Contracts & invoices")}</strong><p>{adminT("Tenants, agreements, invoicing entities and billing control.")}</p><span>{adminT("Open contracts →")}</span></Link>
   {entityLinksAvailable&&<Link className={styles.card} href="/admin/workspaces/estates/entities">
    <small>{adminT("04 / ACCOUNTANCY PREPARATION")}</small>
    <strong>{adminT("Properties & legal entities")}</strong>
    <p>{adminT("Record the verified legal owner, cost bearer or manager with supporting evidence and an effective date.")}</p>
    <span>{adminT("Open legal property associations →")}</span>
   </Link>}
   <Link className={styles.card} href="/admin/projects"><small>{adminT("09 / PROJECT PRESENTATIONS")}</small><strong>{adminT("Projects & access")}</strong><p>{adminT("Private listings, project materials and client permissions.")}</p><span>{adminT("Manage projects →")}</span></Link>
  </section>
  <p className={styles.note}>{adminT("Counts represent registered records, not monthly revenue or paid invoices. The financial cockpit provides separate reporting of contracted, forecast and actually received amounts.")}</p>
 </>;
}
