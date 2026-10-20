import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {requireDealsAdmin} from '../../../../../../lib/security/capital-deals';
import DealForm from '../DealForm';
import Documents from '../Documents';
import {addInstalment,recordPayment,voidPayment} from '../actions';
import {type Deal,type Instalment,type Payment,type LoanDocument,money,date,label,paidFor} from '../model';
import s from '../deals.module.css';
export const dynamic='force-dynamic';
export default async function Dossier({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string}>}) {
 const {db}=await requireDealsAdmin();const {id}=await params;const query=await searchParams;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {data:deal,error}=await db.from('mzs_capital_deals').select('*').eq('id',id).single();if(error||!deal)notFound();
 const d=deal as Deal;
 const [schedule,docs]=await Promise.all([
  db.from('mzs_capital_instalments').select('*',{count:'exact'}).eq('deal_id',id).order('due_date').order('created_at').limit(500),
  db.from('mzs_capital_documents').select('id,title,category,version_label,document_status,created_at',{count:'exact'}).eq('deal_id',id).order('created_at',{ascending:false}).limit(500)
 ]);
 const entries=(schedule.data||[]) as Instalment[];
 const paymentResult=entries.length?await db.from('mzs_capital_payments').select('*',{count:'exact'}).in('instalment_id',entries.map(x=>x.id)).order('created_at',{ascending:false}).limit(1000):{data:[],error:null,count:0};
 const payments=(paymentResult.data||[]) as Payment[];
 const complete=!schedule.error&&!paymentResult.error&&schedule.count===entries.length&&paymentResult.count===payments.length;
 const ids=[id,...entries.map(x=>x.id),...payments.map(x=>x.id),...(docs.data||[]).map(x=>x.id)];
 const audit=await db.from('mzs_capital_deal_audit').select('id,table_name,action,created_at,actor_id,new_record').in('row_id',ids).order('created_at',{ascending:false}).limit(30);
 const today=new Date().toISOString().slice(0,10);
 return <><nav className={s.nav}><Link href="/admin/group/capital/deals">← Loans & agreements</Link></nav>
  <p className="mzsEyebrow">MZS CAPITAL / {d.direction==='provided'?'LOAN PROVIDED':'LOAN RECEIVED'}</p><h1>{d.title}</h1>
  <span className={s.badge}>{label(d.status)}</span><span className={s.badge}>{label(d.review_state)}</span><span className={s.badge}>Admin only{process.env.VERCEL_ENV === 'preview' ? ' · Staging' : ''}</span>
  {query.notice&&<p className={s.notice} role={query.notice==='saved'?'status':'alert'}>{query.notice==='saved'?'Saved successfully.':'The change could not be confirmed. Check dates, remaining amount and reference, then reload before retrying.'}</p>}
  <dl className={s.facts}>{[['Original principal',money(d.principal)],['Annual interest',Number(d.annual_rate)+'%'],['Lender',d.lender],['Borrower',d.borrower],['Agreement date',date(d.agreement_date)],['Funding date (source)',date(d.start_date)],['Maturity',date(d.maturity_date)],['Currency','EUR']].map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
  <p className={s.notice}>Original principal is a contractual figure, not a reconciled outstanding balance. A schedule, due date or source deposit entry does not confirm that money was received or paid.</p>
  <section className={s.section}><h2>Terms & source review</h2><p className={s.notes}>{d.notes||'No additional terms recorded.'}</p><h3>Source references</h3><p className={s.notes}>{d.source_reference||'Not yet recorded.'}</p><details><summary>Edit deal details</summary><DealForm deal={d}/></details></section>
  <section className={s.section}><h2>Payment schedule</h2><p>{d.direction==='provided'?'Expected receipts from the borrower.':'Expected payments to the lender.'} Amounts and dates are entered from the supplied schedule; no automatic interest calculation is applied.</p>
   {!complete?<p role="alert">The complete schedule/payment history could not be loaded. Payment actions and totals are unavailable.</p>:<>
   <div className={s.facts}><div><dt>Scheduled interest</dt><dd>{money(entries.filter(x=>x.kind==='interest').reduce((a,x)=>a+Number(x.amount),0))}</dd></div><div><dt>Confirmed against schedule</dt><dd>{money(payments.filter(x=>!x.is_void).reduce((a,x)=>a+Number(x.amount),0))}</dd></div><div><dt>Past due, not confirmed</dt><dd>{entries.filter(x=>x.due_date<today&&paidFor(x.id,payments)<Number(x.amount)).length} instalments</dd></div></div>
   <p>“Not confirmed” may mean payment has occurred but has not yet been reconciled here. It is not a declaration of arrears.</p>
   {entries.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Due / source period</th><th>Type</th><th>Planned</th><th>Confirmed</th><th>Record receipt / payment</th></tr></thead><tbody>{entries.map(i=>{
    const paid=paidFor(i.id,payments);const remaining=Math.round((Number(i.amount)-paid)*100)/100;
    return <tr key={i.id}><td>{date(i.due_date)}<small>{i.period_label}</small><small>{i.note}</small></td><td>{label(i.kind)}</td><td>{money(i.amount)}</td><td>{money(paid)}<small>{remaining===0?'Fully confirmed':paid>0?'Partially confirmed':'Not confirmed'}</small></td><td>{remaining>0?<details><summary>Confirm {d.direction==='provided'?'receipt':'payment'}</summary><form action={recordPayment} className={s.inline}>
     <input type="hidden" name="deal_id" value={id}/><input type="hidden" name="instalment_id" value={i.id}/><input type="hidden" name="payment_id" value={randomUUID()}/>
     <label>Actual amount (EUR)<input name="amount" aria-label="Actual amount" type="number" required min="0.01" max={remaining} step="0.01" defaultValue={remaining}/></label>
     <label>Actual payment date<input name="paid_on" type="date" required max={today}/></label>
     <label>Evidence / bank reference<input name="reference" required minLength={2} maxLength={300}/></label>
     <button>Record confirmed payment</button></form></details>:'Complete'}</td></tr>;
   })}</tbody></table></div>:<p className={s.empty}>No scheduled instalments yet.</p>}
   <details><summary>Add a scheduled instalment</summary><form action={addInstalment} className={s.form}>
    <input type="hidden" name="deal_id" value={id}/><label>Type<select name="kind"><option value="interest">Interest</option><option value="principal">Principal repayment</option><option value="fee">Fee</option></select></label>
    <label>Source period / label<input name="period_label" maxLength={120}/></label><label>Due date<input name="due_date" type="date" required/></label><label>Amount (EUR)<input name="amount" type="number" min="0.01" step="0.01" required/></label>
    <label className={s.wide}>Source note<input name="note" maxLength={1000}/></label><p className={s.wide}>This adds a planned obligation, not a confirmed payment. Existing source schedule entries are retained.</p><button>Add planned instalment</button>
   </form></details>
   <h3>Confirmed payment history</h3>{payments.length?payments.map(p=><div className={s.card} key={p.id}><strong>{money(p.amount)} · {date(p.paid_on)} {p.is_void?'· VOID':''}</strong><p>{p.reference}</p>{p.is_void?<p>Correction reason: {p.void_reason}</p>:<details><summary>Void an incorrect record</summary><form action={voidPayment} className={s.inline}><input type="hidden" name="deal_id" value={id}/><input type="hidden" name="payment_id" value={p.id}/><label>Required correction reason<input name="void_reason" minLength={3} maxLength={500} required/></label><button>Void record and retain history</button></form></details>}</div>):<p>No payments have been confirmed in this module.</p>}
   </>}
  </section>
  <section className={s.section}><h2>Agreements & documents</h2><p>Retained document versions for full administrators only. Downloads open in a new tab using short-lived private links.</p>{docs.error||docs.count!==(docs.data||[]).length?<p role="alert">Document list could not be loaded completely.</p>:<Documents dealId={id} documents={docs.data as LoanDocument[]}/>}</section>
  <section className={s.section}><h2>Activity history</h2><p>Latest 30 recorded changes. Complete records are retained in the audit store.</p>{audit.error?<p role="alert">History unavailable.</p>:<ul>{(audit.data||[]).map(a=><li key={a.id}>{date(a.created_at)} · {a.table_name.replace('mzs_capital_','')} · {a.action.toLowerCase()} · {a.actor_id?'Administrator '+a.actor_id.slice(0,8):'Controlled source import'}{a.new_record?.is_void?' · payment voided':''}</li>)}</ul>}</section>
 </>;
}
