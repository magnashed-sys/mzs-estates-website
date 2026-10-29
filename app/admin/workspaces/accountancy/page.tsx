
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function Workspace(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();
 const {data:bookingData,error:bookingError}=await db.rpc('mzs_admin_bookings_search_v2',{p_offset:0,p_limit:1});
 const years:number[]=!bookingError&&Array.isArray(bookingData?.years)?bookingData.years.filter((y:unknown)=>Number.isInteger(y)&&Number(y)>=1900&&Number(y)<=2199):[];
 return <><section className={styles.intro}><h1 className={styles.heading}>{adminT("Accountancy")}</h1><p className={styles.lead}>{adminT("Expenses, issued invoices and financial exports by legal entity. Select the register you want to review.")}</p></section>
 <section className={styles.grid} aria-label={adminT("Accountancy workflows")}>
   <Link className={styles.card} href="/admin/workspaces/accountancy/documents"><strong>{adminT("Document archive")}</strong><p>{adminT("Private annual accounts, tax returns and analysis reports by entity and financial year. Available in English and Spanish.")}</p><span>{adminT("Open document archive →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/accountancy/sales"><strong>{adminT("Invoices")}</strong><p>{adminT("All issued invoices: standalone, rental contracts, bookings and imported invoices. Review recorded balances and payments to verify.")}</p><span>{adminT("Open invoice register →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/accountancy/invoices"><strong>{adminT("Historical invoices")}</strong><p>{adminT("Search Gripp invoices and credit notes by year, customer and original payment balance.")}</p><span>{adminT("Open invoice archive →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/expenses"><strong>{adminT("Expense register")}</strong><p>{adminT("Purchase drafts, suppliers and expense allocation by property and unit.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/history"><strong>{adminT("Historical weekly statements")}</strong><p>{adminT("Staff statements with source references and costs already invoiced externally.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/reports"><strong>{adminT("Expense reporting & accountant export")}</strong><p>{adminT("Expenses by month, property and category. Export issued invoices and recorded receipts by entity.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/contracts?view=invoices"><strong>{adminT("Rental invoices")}</strong><p>{adminT("Issued rental contract invoices and their receipts.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="#accountant-export"><strong>{adminT("Booking accounts")}</strong><p>{adminT("Annual booking overview; invoices and receipts are available in each booking dossier.")}</p><span>{adminT("Open →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/entities"><strong>{adminT("Legal property associations")}</strong><p>{adminT("Review which entity owns, bears the costs of or manages each property.")}</p><span>{adminT("Open →")}</span></Link>
 </section>
 <section id="accountant-export" className={styles.intro} aria-label={adminT("Accountant year export")}>
  <h2>{adminT("Accountant year overview")}</h2>
  <p className={styles.lead}>{adminT("Booking allocation follows the arrival date, including stays crossing New Year. Payment dates and invoice issue dates remain separate. Historical settlements retain their unknown payment date.")}</p>
  {bookingError?<p role="alert">{adminT("Booking years could not be loaded. Refresh this page to retry.")}</p>:<form action="/admin/bookings/accountant-export" method="GET" style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'end'}}>
   <label>{adminT("Arrival year")}<select name="year" required defaultValue="" style={{display:'block',padding:12,background:'#1d1b16',color:'#eee8dd',border:'1px solid #726046'}}><option value="" disabled>{adminT("Select a year")}</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   <button type="submit" disabled={!years.length} style={{padding:12,background:'#d5c09a',color:'#1a1711',border:0}}>{adminT("Download accountant CSV")}</button>
  </form>}
  <p className={styles.note}>{adminT("Includes all active, confirmed guest bookings for the selected arrival year across properties. Owner stays, test bookings, cancellations and archived bookings are excluded. Recorded settlements are not bank-verified cashflow. This export does not issue an invoice.")}</p>
 </section></>;
}
