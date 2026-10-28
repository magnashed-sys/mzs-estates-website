import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function Workspace(){
 const {db}=await requireEstateAdmin();
 const {data:bookingData,error:bookingError}=await db.rpc('mzs_admin_bookings_search_v2',{p_offset:0,p_limit:1});
 const years:number[]=!bookingError&&Array.isArray(bookingData?.years)?bookingData.years.filter((y:unknown)=>Number.isInteger(y)&&Number(y)>=1900&&Number(y)<=2199):[];
 return <><section className={styles.intro}><h1 className={styles.heading}>Accountancy</h1><p className={styles.lead}>Expenses, issued invoices and financial exports by legal entity. Select the register you want to review.</p></section>
 <section className={styles.grid} aria-label="Accountancy workflows">
   <Link className={styles.card} href="/admin/workspaces/accountancy/invoices"><strong>Historical invoices</strong><p>Search Gripp invoices and credit notes by year, customer and original payment balance.</p><span>Open invoice archive →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/expenses"><strong>Expense register</strong><p>Purchase drafts, suppliers and expense allocation by property and unit.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/history"><strong>Historical weekly statements</strong><p>Staff statements with source references and costs already invoiced externally.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/reports"><strong>Expense reporting & accountant export</strong><p>Expenses by month, property and category. Export issued invoices and recorded receipts by entity.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/group/estates/contracts?view=invoices"><strong>Rental invoices</strong><p>Issued rental contract invoices and their receipts.</p><span>Open →</span></Link>
   <Link className={styles.card} href="#accountant-export"><strong>Booking accounts</strong><p>Annual booking overview; invoices and receipts are available in each booking dossier.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/entities"><strong>Legal property associations</strong><p>Review which entity owns, bears the costs of or manages each property.</p><span>Open →</span></Link>
 </section>
 <section id="accountant-export" className={styles.intro} aria-label="Accountant year export">
  <h2>Accountant year overview</h2>
  <p className={styles.lead}>Booking allocation follows the arrival date, including stays crossing New Year. Payment dates and invoice issue dates remain separate. Historical settlements retain their unknown payment date.</p>
  {bookingError?<p role="alert">Booking years could not be loaded. Refresh this page to retry.</p>:<form action="/admin/bookings/accountant-export" method="GET" style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'end'}}>
   <label>Arrival year<select name="year" required defaultValue="" style={{display:'block',padding:12,background:'#1d1b16',color:'#eee8dd',border:'1px solid #726046'}}><option value="" disabled>Select a year</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   <button type="submit" disabled={!years.length} style={{padding:12,background:'#d5c09a',color:'#1a1711',border:0}}>Download accountant CSV</button>
  </form>}
  <p className={styles.note}>Includes all active, confirmed guest bookings for the selected arrival year across properties. Owner stays, test bookings, cancellations and archived bookings are excluded. Recorded settlements are not bank-verified cashflow. This export does not issue an invoice.</p>
 </section></>;
}
