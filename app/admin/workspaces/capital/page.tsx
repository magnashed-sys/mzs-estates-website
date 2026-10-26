import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function CapitalWorkspace(){
 const {db}=await requireEstateAdmin();
 const [deals,requests]=await Promise.all([
  db.from("mzs_capital_deals").select("id",{count:"exact",head:true}),
  db.from("mzs_capital_requests").select("id",{count:"exact",head:true})
 ]);
 const counts=[{label:"Loan & agreement dossiers",result:deals},{label:"Capital enquiries",result:requests}];
 const unavailable=counts.filter(x=>x.result.error||x.result.count===null);
 return <>
  <section className={styles.intro}>
   <p className={styles.kicker}>MZS CAPITAL / CAPITAL COCKPIT</p>
   <h1 className={styles.heading}>Private Capital.</h1>
   <p className={styles.lead}>Dedicated access to private loans, borrower and lender relationships, financing requests and introductory conversations. This workspace deliberately does not load rental bookings or property registers.</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">Some Capital counts are unavailable ({unavailable.map(x=>x.label).join(", ")}). No incomplete figures are shown as zero.</p>}
  <section className={styles.stats} aria-label="Capital register counts">
   {counts.map(x=><div className={styles.stat} key={x.label}><small>{x.label}</small><strong>{x.result.error||x.result.count===null?"Unavailable":x.result.count}</strong></div>)}
  </section>
  <section className={styles.grid} aria-label="Capital workflows">
   <Link className={styles.card} href="/admin/group/capital/deals"><small>01 / FINANCING</small><strong>Loans & agreements</strong><p>Individual lender and borrower dossiers, repayment schedules, interest and confirmations.</p><span>Open lending dossiers →</span></Link>
   <Link className={styles.card} href="/admin/capital-requests"><small>02 / ENQUIRIES</small><strong>Capital requests</strong><p>Review confidential financing and investment enquiries.</p><span>Open requests →</span></Link>
   <Link className={styles.card} href="/admin/intro-calls"><small>03 / CONVERSATIONS</small><strong>Introduction calls</strong><p>Manage confidential introductory-call requests and their next steps.</p><span>Open calls →</span></Link>
   <Link className={styles.card} href="/admin?tab=capital"><small>04 / EXISTING ADMINISTRATION</small><strong>Capital operations</strong><p>Access all current Capital-specific administrative controls while the transition continues.</p><span>Open current Capital admin →</span></Link>
  </section>
  <p className={styles.note}>Loan and enquiry counts are record counts, not committed funds or payments. Existing financial scopes, lender access and contract checks remain enforced by their original protected routes.</p>
 </>;
}
