
import {getAdminI18n} from '../../../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {operationsDay} from '../../../../../../../lib/property-operations/action-queues';
import {loadExternalReceipts,externalPaymentTotals} from '../../../../../../../lib/finance/external-receipts';
import {PaymentForm,ReversalForm} from '../../standalone/PaymentForms';
import s from '../../sales.module.css';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const money=(n:number, adminLocale = 'en-GB')=>new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(n/100);
export default async function ImportedInvoice({params}:{params:Promise<{id:string}>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();const {id}=await params;if(!uuid.test(id))notFound();
 const {data:i,error}=await db.from('mzs_invoice_archive_active').select('id,issuer_id,issuer_name,number,customer_name,subject,issued_on,due_on,gross_cents,source_paid_cents,source_open_cents').eq('id',id).maybeSingle();
 if(error)throw Error('Imported invoice unavailable');if(!i)notFound();
 // A canonical live invoice owns payments if an imported copy also exists.
 const [rental,booking,external]=await Promise.all(['mzs_lease_invoices','mzs_booking_invoices','mzs_ops_external_sales_invoices'].map(table=>db.from(table).select(table==='mzs_booking_invoices'?'id,number,booking_id':'id,number',{count:'exact'}).eq('issuer_id',i.issuer_id).returns<{id:string;number:string;booking_id?:string}[]>()));
 for(const r of [rental,booking,external])if(r.error||r.count!==r.data?.length)throw Error('Invoice identity could not be verified');
 const matches=[rental,booking,external].map(r=>r.data?.find(x=>x.number.trim().toUpperCase()===i.number.trim().toUpperCase()));
 if(matches[0])redirect('/admin/group/estates/contracts?view=billing');if(matches[1])redirect('/admin/bookings/'+(matches[1] as {booking_id?:string}).booking_id);if(matches[2])redirect('/admin/workspaces/accountancy/sales/standalone/'+matches[2].id);
 const receipts=await loadExternalReceipts(db,[id],'archive'),added=receipts.length?externalPaymentTotals(receipts,id,Math.max(1,i.source_open_cents)).paid??0:0;
 if(![i.gross_cents,i.source_paid_cents,i.source_open_cents].every(Number.isSafeInteger)||i.source_paid_cents+i.source_open_cents!==i.gross_cents||added>Math.max(0,i.source_open_cents))throw Error('Invalid imported invoice balance');
 const paid=i.source_paid_cents+added,balance=i.source_open_cents-added,today=operationsDay(),status=i.gross_cents<0?'Credit note':balance<0?'Credit balance':balance===0?'Paid':i.due_on<today?'Overdue':paid>0?'Partly paid':'Open';
 return <section className={s.page}><Link href="/admin/workspaces/accountancy/sales">{adminT("← Invoices")}</Link><header className={s.heading}><div><p className={s.eyebrow}>{adminT("IMPORTED INVOICE")}</p><h1>{i.number}</h1><p>{i.customer_name} · {i.issuer_name}</p></div><span className={s.badge}>{adminT(status)}</span></header><p>{i.subject}</p><p>{adminT("Issued:")} {i.issued_on}  {adminT("· Due:")} {i.due_on}</p>
 <div className={s.metrics}><div><span>{adminT("Total incl. VAT")}</span><strong>{money(i.gross_cents, adminLocale)}</strong></div><div><span>{adminT("Recorded paid")}</span><strong>{money(paid, adminLocale)}</strong><small>{adminT("Imported:")} {money(i.source_paid_cents, adminLocale)}  {adminT("· new receipts:")} {money(added, adminLocale)}</small></div><div><span>{adminT("Remaining balance")}</span><strong>{money(balance, adminLocale)}</strong></div></div>
 <p>{adminT("The imported paid amount is an opening snapshot without payment dates. Only record additional receipts that are not already included in that amount. Reversing a new receipt restores the corresponding balance; it does not change the import.")}</p>
 {i.gross_cents>0&&i.source_paid_cents>=0?<PaymentForm invoiceId={id} requestId={randomUUID()} remaining={balance} today={today} source="archive"/>:<p>{adminT("Credit notes and credit balances do not accept incoming payment registrations.")}</p>}
 <h2>{adminT("New payment history")}</h2>{!receipts.length?<p>{adminT("No additional receipts recorded yet.")}</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Received on")}</th><th>{adminT("Amount")}</th><th>{adminT("Reference")}</th><th>{adminT("History")}</th></tr></thead><tbody>{receipts.map(r=><tr key={r.id}><td>{r.received_on}</td><td>{money(r.amount_cents, adminLocale)}</td><td>{r.reference}</td><td><p>{adminT("Recorded")} {r.created_at.slice(0,19).replace('T',' ')}  {adminT("UTC")}</p><small>{adminT("Account")} {r.recorded_by}</small>{r.reversed_at?<><strong>{adminT("Reversed")}</strong><p>{r.reversal_reason}</p><small>{r.reversed_at.slice(0,19).replace('T',' ')}  {adminT("UTC · account")} {r.reversed_by}</small></>:<ReversalForm invoiceId={id} receiptId={r.id} source="archive"/>}</td></tr>)}</tbody></table></div>}
 <Link href={'/admin/workspaces/accountancy/invoices/'+id}>{adminT("Original imported invoice and customer →")}</Link></section>;
}
