
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function CapitalWorkspace(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();
 const [deals,requests]=await Promise.all([
  db.from("mzs_capital_deals").select("id",{count:"exact",head:true}),
  db.from("mzs_capital_requests").select("id",{count:"exact",head:true})
 ]);
 const counts=[{label:"Loan & agreement dossiers",result:deals},{label:"Capital enquiries",result:requests}];
 const unavailable=counts.filter(x=>x.result.error||x.result.count===null);
 return <>
  <section className={styles.intro}>
   <p className={styles.kicker}>{adminT("MZS CAPITAL / CAPITAL COCKPIT")}</p>
   <h1 className={styles.heading}>{adminT("Private Capital.")}</h1>
   <p className={styles.lead}>{adminT("Dedicated access to private loans, borrower and lender relationships, financing requests and introductory conversations. This workspace deliberately does not load rental bookings or property registers.")}</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">{adminT("Some Capital counts are unavailable (")}{unavailable.map(x=>x.label).join(", ")}{adminT("). No incomplete figures are shown as zero.")}</p>}
  <section className={styles.stats} aria-label={adminT("Capital register counts")}>
   {counts.map(x=><div className={styles.stat} key={x.label}><small>{adminT(x.label)}</small><strong>{x.result.error||x.result.count===null?adminT("Unavailable"):x.result.count}</strong></div>)}
  </section>
  <section className={styles.grid} aria-label={adminT("Capital workflows")}>
   <Link className={styles.card} href="/admin/group/capital/deals"><small>{adminT("01 / FINANCING")}</small><strong>{adminT("Loans & agreements")}</strong><p>{adminT("Individual lender and borrower dossiers, repayment schedules, interest and confirmations.")}</p><span>{adminT("Open lending dossiers →")}</span></Link>
   <Link className={styles.card} href="/admin/capital-requests"><small>{adminT("02 / ENQUIRIES")}</small><strong>{adminT("Capital requests")}</strong><p>{adminT("Review confidential financing and investment enquiries.")}</p><span>{adminT("Open requests →")}</span></Link>
   <Link className={styles.card} href="/admin/intro-calls"><small>{adminT("03 / CONVERSATIONS")}</small><strong>{adminT("Introduction calls")}</strong><p>{adminT("Manage confidential introductory-call requests and their next steps.")}</p><span>{adminT("Open calls →")}</span></Link>
   <Link className={styles.card} href="/admin/group/capital"><small>{adminT("04 / EXISTING ADMINISTRATION")}</small><strong>{adminT("Capital operations")}</strong><p>{adminT("Access all current Capital-specific administrative controls while the transition continues.")}</p><span>{adminT("Open current Capital admin →")}</span></Link>
  </section>
  <p className={styles.note}>{adminT("Loan and enquiry counts are record counts, not committed funds or payments. Existing financial scopes, lender access and contract checks remain enforced by their original protected routes.")}</p>
 </>;
}
