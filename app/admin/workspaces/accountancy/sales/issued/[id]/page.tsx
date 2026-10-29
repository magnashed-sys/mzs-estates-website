import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {operationsDay} from '../../../../../../../lib/property-operations/action-queues';
import {loadExternalReceipts,externalPaymentTotals} from '../../../../../../../lib/finance/external-receipts';
import {PaymentForm,ReversalForm} from '../../standalone/PaymentForms';
import s from '../../sales.module.css';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const money=(n:number|null)=>n===null?'Not recorded':new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(n/100);
export default async function StandaloneInvoice({params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin();const {id}=await params;if(!uuid.test(id))notFound();
 const {data:invoice,error}=await db.from('mzs_service_invoices').select('*').eq('id',id).maybeSingle();
 if(error)throw Error('Standalone invoice unavailable');if(!invoice)notFound();
 const [receipts,customer,issuer]=await Promise.all([loadExternalReceipts(db,[id],'service'),db.from('mzs_lease_relationships').select('name').eq('id',invoice.customer_id).single(),db.from('mzs_lease_issuers').select('name').eq('id',invoice.issuer_id).single()]);
 if(customer.error||issuer.error||!customer.data?.name||!issuer.data?.name||invoice.currency!=='EUR'||invoice.status!=='issued'||invoice.net_cents+invoice.vat_cents!==invoice.gross_cents)throw Error('Incomplete invoice details');
 const recorded=externalPaymentTotals(receipts,id,invoice.gross_cents),payment={paid:recorded.paid??0,balance:invoice.gross_cents-(recorded.paid??0)},today=operationsDay(),status=payment.balance===null?'Payment unknown':payment.balance===0?'Paid':invoice.due_on<today?'Overdue':'Partly paid';
 return <section className={s.page}><Link href="/admin/workspaces/accountancy/sales">← Invoices</Link><header className={s.heading}><div><p className={s.eyebrow}>STANDALONE INVOICE</p><h1>{invoice.number}</h1><p>{customer.data.name} · {issuer.data.name}</p></div><span className={status==='Overdue'?s.overdue:s.badge}>{status}</span></header>
 <p>{invoice.payload.subject}</p><p>Issued: {invoice.issued_on} · Due: {invoice.due_on}</p>
 <div className={s.metrics}><div><span>Total incl. VAT</span><strong>{money(invoice.gross_cents)}</strong><small>{money(invoice.net_cents)} excl. VAT · {money(invoice.vat_cents)} VAT</small></div><div><span>Recorded paid</span><strong>{money(payment.paid)}</strong></div><div><span>Remaining balance</span><strong>{money(payment.balance)}</strong><small>Based on active recorded receipts</small></div></div>
 {payment.balance===null&&<p>No active payment is recorded. The balance is unknown until actual receipts are entered.</p>}
 <PaymentForm invoiceId={id} source="service" requestId={randomUUID()} remaining={payment.balance??invoice.gross_cents} today={today}/>
 <h2>Payment history</h2>{!receipts.length?<p>No receipts recorded yet.</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Received on</th><th>Amount</th><th>Reference</th><th>History</th></tr></thead><tbody>{receipts.map(r=><tr key={r.id}><td>{r.received_on}</td><td>{money(r.amount_cents)}</td><td>{r.reference}</td><td><p>Recorded {r.created_at.slice(0,19).replace('T',' ')} UTC</p><small>Recorded by account {r.recorded_by}</small>{r.reversed_at?<><strong>Reversed</strong><p>{r.reversal_reason}</p><small>{r.reversed_at.slice(0,19).replace('T',' ')} UTC · account {r.reversed_by}</small></>:<ReversalForm source="service" invoiceId={id} receiptId={r.id}/>}</td></tr>)}</tbody></table></div>}
 <p className={s.notes}>This invoice is issued and immutable. Payment corrections retain their history. No email was sent when issuing.</p><Link className={s.button} href={'/admin/workspaces/accountancy/sales/documents/'+id} target="_blank" rel="noopener noreferrer">Open invoice PDF ↗</Link>
 </section>;
}
