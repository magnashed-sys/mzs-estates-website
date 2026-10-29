
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function RelationshipsWorkspace(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();
 const [people,relationships,requests]=await Promise.all([
  db.from("profiles").select("id",{count:"exact",head:true}).in("role",["client","partner"]),
  db.from("mzs_lease_relationships").select("id",{count:"exact",head:true}),
  db.from("access_requests").select("id",{count:"exact",head:true}).eq("status","pending")
 ]);
 const counts=[
  {label:"Client & partner accounts",result:people},
  {label:"CRM relationships",result:relationships},
  {label:"Pending access requests",result:requests}
 ];
 const unavailable=counts.filter(x=>x.result.error||x.result.count===null);
 return <>
  <section className={styles.intro}>
   <p className={styles.kicker}>{adminT("MZS GROUP / RELATIONSHIPS")}</p>
   <h1 className={styles.heading}>{adminT("Clients & relationships.")}</h1>
   <p className={styles.lead}>{adminT("A separate starting point for the CRM, companies, applications and individual project access. Sensitive relationship details load only when you open their protected register or dossier.")}</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">{adminT("Some relationship counts could not be loaded (")}{unavailable.map(x=>x.label).join(", ")}{adminT("). The corresponding figures have been hidden.")}</p>}
  <section className={styles.stats} aria-label={adminT("Relationship register counts")}>
   {counts.map(x=><div className={styles.stat} key={x.label}><small>{adminT(x.label)}</small><strong>{x.result.error||x.result.count===null?adminT("Unavailable"):x.result.count}</strong></div>)}
  </section>
  <section className={styles.grid} aria-label={adminT("Relationship workflows")}>
   <Link className={styles.card} href="/admin/relationships"><small>{adminT("01 / RELATIONSHIP 360°")}</small><strong>{adminT("People & companies")}</strong><p>{adminT("Central records, correspondence details, company roles and linked relationships.")}</p><span>{adminT("Open CRM →")}</span></Link>
   <Link className={styles.card} href="/admin/accounts"><small>{adminT("02 / ONBOARDING")}</small><strong>{adminT("Access requests")}</strong><p>{adminT("Review new accounts, approve registrations and administer invitations.")}</p><span>{adminT("Review applications →")}</span></Link>
   <Link className={styles.card} href="/admin/project-access"><small>{adminT("03 / ACCESS CONTROL")}</small><strong>{adminT("Project permissions")}</strong><p>{adminT("Grant or revoke individual access without changing public accounts.")}</p><span>{adminT("Manage permissions →")}</span></Link>
   <Link className={styles.card} href="/admin/relationships?new=person"><small>{adminT("04 / NEW CONTACT")}</small><strong>{adminT("Create relationship")}</strong><p>{adminT("Add a person to the CRM without giving them platform login rights.")}</p><span>{adminT("Add person →")}</span></Link>
   <Link className={styles.card} href="/admin/relationships?new=company"><small>{adminT("05 / ORGANISATIONS")}</small><strong>{adminT("Create company")}</strong><p>{adminT("Register legal and correspondence details separately from account access.")}</p><span>{adminT("Add company →")}</span></Link>
   <Link className={styles.card} href="/admin/member-companies"><small>{adminT("MEMBER COMPANIES")}</small><strong>{adminT("Account-linked companies")}</strong><p>{adminT("Review companies submitted by members and their account associations.")}</p><span>{adminT("Open member companies →")}</span></Link>
  </section>
  <p className={styles.note}>{adminT("Self-declared companies and CRM relationships are not interchangeable with verified legal ownership or access permissions. Existing administrator and client-role checks are unchanged.")}</p>
 </>;
}
