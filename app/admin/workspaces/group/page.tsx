import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import DailyOperations from "../../DailyOperations";
import FinancialCockpit from "../../FinancialCockpit";
import GroupActionCenter from "../../GroupActionCenter";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function GroupWorkspace(){
 await requireEstateAdmin();
 return <>
  <section className={styles.intro}>
   <p className={styles.kicker}>MZS GROUP / GROUP COCKPIT</p>
   <h1 className={styles.heading}>Group overview.</h1>
   <p className={styles.lead}>Financial insight, upcoming arrivals and work requiring your attention. Financial figures remain sourced from the existing protected financial reporting endpoint.</p>
   <div className={styles.actions}>
    <Link href="/admin/bookings">Open central Bookings →</Link>
    <Link href="/admin/workspaces/estates">Property management →</Link>
    <Link href="/admin/workspaces/capital">Private Capital →</Link>
    <Link href="/admin/workspaces/relationships">Relationships →</Link>
   </div>
  </section>
  <FinancialCockpit refreshVersion={0}/>
  <GroupActionCenter refreshVersion={0}/>
  <DailyOperations/>
  <p className={styles.note}>The central overview reports recorded and forecast figures separately. Booked rent and scheduled loan interest do not prove cash receipt. Account approvals and administrative settings are available from Relationships and System.</p>
 </>;
}
