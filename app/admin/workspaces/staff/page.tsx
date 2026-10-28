import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function Workspace(){
 await requireEstateAdmin();
 return <><section className={styles.intro}><h1 className={styles.heading}>Staff</h1><p className={styles.lead}>All staff matters in one place: access, work visits, time entries, reviews and corrections.</p></section>
 <section className={styles.grid} aria-label="Staff workflows">
   <Link className={styles.card} href="/admin/workspaces/estates/staff#staff-access"><strong>Staff & property access</strong><p>Assign properties and review recorded access by staff member.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/staff"><strong>Work visits & time register</strong><p>Review recorded work, decisions and history by staff member and property.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=visits"><strong>Review time entries</strong><p>Review new work visits awaiting a decision.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=corrections"><strong>Time corrections</strong><p>Handle correction requests while preserving the original record.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/time-report"><strong>Time reporting</strong><p>Filter by period, staff member and property, then download the full selection as CSV.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/history"><strong>Historical staff statements</strong><p>View expense statements and linked invoices in Accountancy; invoiced hours remain separate from actual recorded hours.</p><span>Open →</span></Link>
 </section></>;
}
