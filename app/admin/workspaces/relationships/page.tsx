import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function RelationshipsWorkspace(){
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
   <p className={styles.kicker}>MZS GROUP / RELATIONSHIPS</p>
   <h1 className={styles.heading}>Clients & relationships.</h1>
   <p className={styles.lead}>A separate starting point for the CRM, companies, applications and individual project access. Sensitive relationship details load only when you open their protected register or dossier.</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">Some relationship counts could not be loaded ({unavailable.map(x=>x.label).join(", ")}). The corresponding figures have been hidden.</p>}
  <section className={styles.stats} aria-label="Relationship register counts">
   {counts.map(x=><div className={styles.stat} key={x.label}><small>{x.label}</small><strong>{x.result.error||x.result.count===null?"Unavailable":x.result.count}</strong></div>)}
  </section>
  <section className={styles.grid} aria-label="Relationship workflows">
   <Link className={styles.card} href="/admin/relationships"><small>01 / RELATIONSHIP 360°</small><strong>People & companies</strong><p>Central records, correspondence details, company roles and linked relationships.</p><span>Open CRM →</span></Link>
   <Link className={styles.card} href="/admin/accounts"><small>02 / ONBOARDING</small><strong>Access requests</strong><p>Review new accounts, approve registrations and administer invitations.</p><span>Review applications →</span></Link>
   <Link className={styles.card} href="/admin/project-access"><small>03 / ACCESS CONTROL</small><strong>Project permissions</strong><p>Grant or revoke individual access without changing public accounts.</p><span>Manage permissions →</span></Link>
   <Link className={styles.card} href="/admin/relationships?new=person"><small>04 / NEW CONTACT</small><strong>Create relationship</strong><p>Add a person to the CRM without giving them platform login rights.</p><span>Add person →</span></Link>
   <Link className={styles.card} href="/admin/relationships?new=company"><small>05 / ORGANISATIONS</small><strong>Create company</strong><p>Register legal and correspondence details separately from account access.</p><span>Add company →</span></Link>
  </section>
  <p className={styles.note}>Self-declared companies and CRM relationships are not interchangeable with verified legal ownership or access permissions. Existing administrator and client-role checks are unchanged.</p>
 </>;
}
