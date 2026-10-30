
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function Workspace(){
 const {t:adminT,locale:adminLocale,language}=await getAdminI18n();

 await requireEstateAdmin();
 return <><section className={styles.intro}><h1 className={styles.heading}>{adminT("Staff")}</h1><p className={styles.lead}>{adminT("All staff matters in one place: access, work visits, time entries, reviews and corrections.")}</p></section>
 <section className={styles.grid} aria-label={adminT("Staff workflows")}>
 <Link className={styles.card} href="/admin/workspaces/estates/zorgbalans"><strong>{language==='es'?'Zorgbalans · Facturación privada':'Zorgbalans · Private billing'}</strong><p>{language==='es'?'Horas aprobadas y borradores de facturación privada para Stichting Zorgbalans.':'Approved working time and separate private invoice drafts for Stichting Zorgbalans.'}</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/operations"><strong>{adminT("Operations")}</strong><p>{adminT("Open tasks, maintenance, pending time reviews and corrections in one central control panel.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/staff#staff-access"><strong>{adminT("Staff & property access")}</strong><p>{adminT("Assign properties and review recorded access by staff member.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/staff"><strong>{adminT("Work visits & time register")}</strong><p>{adminT("Review recorded work, decisions and history by staff member and property.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=visits"><strong>{adminT("Review time entries")}</strong><p>{adminT("Review new work visits awaiting a decision.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=corrections"><strong>{adminT("Time corrections")}</strong><p>{adminT("Handle correction requests while preserving the original record.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/weekly"><strong>{language==='es'?'Aprobación y cierre semanal de horas':'Weekly time approval & closeout'}</strong><p>{language==='es'?'Aprobar varias visitas, cerrar semanas ISO y exportar resúmenes PDF y Excel.':'Approve multiple visits, close ISO weeks, export PDF and Excel summaries.'}</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/time-report"><strong>{adminT("Time reporting")}</strong><p>{adminT("Filter by period, staff member and property, then download the full selection as CSV.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/history"><strong>{adminT("Historical staff statements")}</strong><p>{adminT("View expense statements and linked invoices in Accountancy; invoiced hours remain separate from actual recorded hours.")}</p><span>{adminT("Open →")}</span></Link>
 </section></>;
}
