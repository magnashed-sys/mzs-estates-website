
import {getAdminI18n} from '../../../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {operationsDay} from '../../../../../../../lib/property-operations/action-queues';
import {loadExternalReceipts,externalPaymentTotals} from '../../../../../../../lib/finance/external-receipts';
import {PaymentForm,ReversalForm} from '../PaymentForms';
import s from '../../sales.module.css';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const money=(n:number|null, adminLocale = 'en-GB')=>n===null?'Not recorded':new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(n/100);
export default async function StandaloneInvoice({params}:{params:Promise<{id:string}>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();const {id}=await params;if(!uuid.test(id))notFound();
 const {data:invoice,error}=await db.from('mzs_ops_external_sales_invoices').select('id,batch_id,issuer_id,customer_id,number,issued_on,due_on,customer_reference,net_cents,vat_cents,gross_cents,currency,status').eq('id',id).maybeSingle();
 if(error)throw Error('Standalone invoice unavailable');if(!invoice)notFound();
 const [receipts,customer,issuer,batch]=await Promise.all([loadExternalReceipts(db,[id]),db.from('mzs_lease_relationships').select('name').eq('id',invoice.customer_id).single(),db.from('mzs_lease_issuers').select('name').eq('id',invoice.issuer_id).single(),db.from('mzs_ops_historical_batches').select('reporting_year').eq('id',invoice.batch_id).single()]);
 if(customer.error||issuer.error||batch.error||!customer.data?.name||!issuer.data?.name||!batch.data||invoice.currency!=='EUR'||invoice.status!=='externally_issued'||invoice.net_cents+invoice.vat_cents!==invoice.gross_cents)throw Error('Incomplete invoice details');
 const payment=externalPaymentTotals(receipts,id,invoice.gross_cents),today=operationsDay(),status=payment.balance===null?'Payment unknown':payment.balance===0?'Paid':invoice.due_on<today?'Overdue':'Partly paid';
 return <section className={s.page}><Link href="/admin/workspaces/accountancy/sales">{adminT("← Invoices")}</Link><header className={s.heading}><div><p className={s.eyebrow}>{adminT("STANDALONE INVOICE")}</p><h1>{invoice.number}</h1><p>{customer.data.name} · {issuer.data.name}</p></div><span className={status==='Overdue'?s.overdue:s.badge}>{adminT(status)}</span></header>
 <p>{invoice.customer_reference}</p><p>{adminT("Issued:")} {invoice.issued_on}  {adminT("· Due:")} {invoice.due_on}</p>
 <div className={s.metrics}><div><span>{adminT("Total incl. VAT")}</span><strong>{money(invoice.gross_cents, adminLocale)}</strong><small>{money(invoice.net_cents, adminLocale)}  {adminT("excl. VAT ·")} {money(invoice.vat_cents, adminLocale)}  {adminT("VAT")}</small></div><div><span>{adminT("Recorded paid")}</span><strong>{money(payment.paid, adminLocale)}</strong></div><div><span>{adminT("Remaining balance")}</span><strong>{money(payment.balance, adminLocale)}</strong><small>{adminT("Based on active recorded receipts")}</small></div></div>
 {payment.balance===null&&<p>{adminT("No active payment is recorded. The balance is unknown until actual receipts are entered.")}</p>}
 <PaymentForm invoiceId={id} requestId={randomUUID()} remaining={payment.balance??invoice.gross_cents} today={today}/>
 <h2>{adminT("Payment history")}</h2>{!receipts.length?<p>{adminT("No receipts recorded yet.")}</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Received on")}</th><th>{adminT("Amount")}</th><th>{adminT("Reference")}</th><th>{adminT("History")}</th></tr></thead><tbody>{receipts.map(r=><tr key={r.id}><td>{r.received_on}</td><td>{money(r.amount_cents, adminLocale)}</td><td>{r.reference}</td><td><p>{adminT("Recorded")} {r.created_at.slice(0,19).replace('T',' ')}  {adminT("UTC")}</p><small>{adminT("Recorded by account")} {r.recorded_by}</small>{r.reversed_at?<><strong>{adminT("Reversed")}</strong><p>{r.reversal_reason}</p><small>{r.reversed_at.slice(0,19).replace('T',' ')}  {adminT("UTC · account")} {r.reversed_by}</small></>:<ReversalForm invoiceId={id} receiptId={r.id}/>}</td></tr>)}</tbody></table></div>}
 <p className={s.notes}>{adminT("A correction reverses the registration and retains the original amount, date, reference and actor. Enter a replacement separately if needed. Original invoice data is unchanged.")} <Link href={'/admin/workspaces/estates/history?year='+batch.data.reporting_year+'#invoice-'+id}>{adminT("Original invoice and source statement →")}</Link></p>
 </section>;
}
