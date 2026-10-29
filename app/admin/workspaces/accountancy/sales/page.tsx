import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {operationsDay} from '../../../../../lib/property-operations/action-queues';
import {invoiceFilters,invoiceHref,invoiceSources,invoiceStatuses,invoiceStatus,loadInvoiceRegister,selectInvoices} from '../../../../../lib/finance/invoice-register';
import s from './sales.module.css';
export const dynamic='force-dynamic';
const money=(n:number|null)=>n===null?'Not recorded':new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(n/100);
const date=(d:string|null)=>d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z')):'See payment terms';
export default async function Invoices({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db}=await requireEstateAdmin();
 let filters;try{filters=invoiceFilters(await searchParams);}catch{return <section className={s.page}><h1>Invalid invoice filters</h1><Link href="/admin/workspaces/accountancy/sales">Clear filters</Link></section>;}
 const today=operationsDay(),all=await loadInvoiceRegister(db,filters.year),{rows,totals}=selectInvoices(all,filters,today);
 const entities=Array.from(new Map(all.map(i=>[i.issuerId,i.issuer])).entries()).sort((a,b)=>a[1].localeCompare(b[1]));
 const pages=Math.max(1,Math.ceil(rows.length/25));if(filters.page>pages)redirect(invoiceHref(filters,pages));
 const pageRows=rows.slice((filters.page-1)*25,filters.page*25);
 return <section className={s.page}>
  <Link href="/admin/workspaces/accountancy" className={s.back}>← Accountancy</Link>
  <header className={s.heading}><div><p className={s.eyebrow}>SALES / ISSUED INVOICES</p><h1>Invoices</h1><p>Standalone, rental contract, booking and imported invoices in one place.</p></div><Link className={s.button} href={invoiceHref(filters,1,true)} prefetch={false}>Download CSV</Link></header>
  <p><Link className={s.button} href="/admin/workspaces/accountancy/sales/new">Create invoice / review drafts →</Link></p>
  <form method="get" className={s.filters}>
   <label>Search<input name="q" maxLength={150} defaultValue={filters.q} placeholder="Customer, number or description"/></label>
   <label>Invoice year<select name="year" defaultValue={filters.year??'all'}><option value="all">All years</option>{Array.from({length:Math.max(Number(today.slice(0,4))+2,filters.year??0)-1999},(_,i)=>Math.max(Number(today.slice(0,4))+2,filters.year??0)-i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   <label>Entity<select name="entity" defaultValue={filters.entity}><option value="all">All entities</option>{!entities.some(([id])=>id===filters.entity)&&filters.entity!=='all'&&<option value={filters.entity}>Selected entity (no invoices)</option>}{entities.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>Source<select name="source" defaultValue={filters.source}><option value="all">All sources</option>{Object.entries(invoiceSources).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>Payment status<select name="status" defaultValue={filters.status}>{Object.entries(invoiceStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <button className={s.button}>Apply filters</button><Link href="/admin/workspaces/accountancy/sales">Reset</Link>
  </form>
  <div className={s.metrics} aria-label="Totals for the full filtered selection">
   <div><span>Invoices · full selection</span><strong>{totals.count}</strong><small>{money(totals.gross)} incl. VAT · credits included</small></div>
   <div><span>Recorded outstanding</span><strong>{money(totals.outstanding)}</strong><small>Excludes unknown payment balances</small></div>
   <div><span>Overdue recorded balance</span><strong>{money(totals.overdue)}</strong><small>Due before {date(today)}</small></div>
   <div><span>Payment to verify</span><strong>{totals.unknown}</strong><small>{money(totals.unknownGross)} invoiced · balance unknown</small></div>
  </div>
  <div className={s.tableWrap}><table className={s.table}><caption>Issued invoices · {filters.year??'all years'} · newest first</caption><thead><tr>{['Invoice / customer','Source','Issued','Due','Total incl. VAT','Recorded paid','Balance','Status','Open'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
   {pageRows.map(i=><tr key={i.source+':'+i.id}>
    <td><strong>{i.number}</strong><br/>{i.customer}<small>{i.issuer}</small><small>{i.subject}</small></td>
    <td>{invoiceSources[i.source]}{i.alsoImported&&<small>Imported copy matched</small>}</td><td className={s.nowrap}>{date(i.issuedOn)}</td><td className={s.nowrap}>{date(i.dueOn)}</td>
    <td className={s.amount}>{money(i.gross)}</td><td className={s.amount}>{money(i.paid)}</td><td className={s.amount}>{money(i.balance)}</td>
    <td><span className={invoiceStatus(i,today)==='Overdue'?s.overdue:s.badge}>{invoiceStatus(i,today)}</span><small>{i.paymentBasis==='imported_snapshot'?'Imported balance snapshot':i.paymentBasis==='imported_plus_receipts'?'Imported balance + new receipts':i.paymentBasis==='not_recorded'?'Payment not yet recorded':'Recorded receipts'}</small></td>
    <td><Link href={i.href}>{i.gross>0&&(i.balance===null||i.balance>0)?'Record payment →':'Details / payments →'}</Link></td>
   </tr>)}
  </tbody></table></div>
  {!pageRows.length&&<p className={s.empty}>No issued invoices match these filters.</p>}
  <nav className={s.pagination} aria-label="Invoice pages">{filters.page>1&&<Link href={invoiceHref(filters,filters.page-1)} prefetch={false}>← Previous</Link>}<span>Page {filters.page} of {pages} · {rows.length} invoices</span>{filters.page<pages&&<Link href={invoiceHref(filters,filters.page+1)} prefetch={false}>Next →</Link>}</nav>
  <div className={s.notes}><p>Imported payments and balances reflect the source export, not a live bank connection. A negative balance is a credit. Unknown payments are not treated as paid or unpaid. Booking due dates follow the payment schedule in the dossier.</p><p>New contract invoices appear automatically after issue. Drafts and future contract periods are not invoices yet. <Link href="/admin/group/estates/contracts?view=invoices">Review contract drafts →</Link></p><p>Excluded imported invoices remain in the <Link href="/admin/workspaces/accountancy/invoices?balance=excluded">archive</Link> and do not count here. Viewing this register does not issue, send or mark an invoice as paid.</p></div>
 </section>;
}
