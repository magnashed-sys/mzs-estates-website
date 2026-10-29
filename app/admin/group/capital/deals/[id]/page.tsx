
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {requireDealsAdmin} from '../../../../../../lib/security/capital-deals';
import DealForm from '../DealForm';
import Documents from '../Documents';
import ClientAccess,{type ClientGrant,type AccessRelationship} from '../ClientAccess';
import {addInstalment,recordPayment,voidPayment,correctInterestReceipt} from '../actions';
import {allocateInterestCredits} from '../../../../../../lib/capital/interest-allocation';
import {type Deal,type Instalment,type Payment,type LoanDocument,money,date,label,paidFor} from '../model';
import s from '../deals.module.css';
export const dynamic='force-dynamic';
export default async function Dossier({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string;mail?:string}>}) {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireDealsAdmin();const {id}=await params;const query=await searchParams;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {data:deal,error}=await db.from('mzs_capital_deals').select('*').eq('id',id).single();if(error||!deal)notFound();
 const d=deal as Deal;
 const [schedule,docs,access,relationships,entitiesResult]=await Promise.all([
  db.from('mzs_capital_instalments').select('*',{count:'exact'}).eq('deal_id',id).order('due_date').order('created_at').limit(500),
  db.from('mzs_capital_documents').select('id,title,category,version_label,document_status,created_at',{count:'exact'}).eq('deal_id',id).order('created_at',{ascending:false}).limit(500),
  db.from('mzs_capital_client_access').select('*',{count:'exact'}).eq('deal_id',id).order('created_at').limit(500),
  db.from('profiles').select('id,email,full_name,role,is_active',{count:'exact'}).in('role',['client','partner']).order('email').limit(1000),
  db.from('mzs_lease_issuers').select('id,name,kind').order('name').limit(1000)
 ]);
 const entries=(schedule.data||[]) as Instalment[];
 const paymentResult=entries.length?await db.from('mzs_capital_payments').select('*',{count:'exact'}).in('instalment_id',entries.map(x=>x.id)).order('created_at',{ascending:false}).limit(1000):{data:[],error:null,count:0};
 const payments=(paymentResult.data||[]) as Payment[];
 const interest=allocateInterestCredits(entries,payments);
 const complete=!schedule.error&&!paymentResult.error&&schedule.count===entries.length&&paymentResult.count===payments.length;
 const ids=[id,...entries.map(x=>x.id),...payments.map(x=>x.id),...(docs.data||[]).map(x=>x.id),...(access.data||[]).map(x=>x.id)];
 const audit=await db.from('mzs_capital_deal_audit').select('id,table_name,action,created_at,actor_id,new_record').in('row_id',ids).order('created_at',{ascending:false}).limit(30);
 const today=new Date().toISOString().slice(0,10);
 return <><nav className={s.nav}><Link href="/admin/group/capital/deals">{adminT("← Loans & agreements")}</Link></nav>
  <p className="mzsEyebrow">{adminT("MZS CAPITAL /")} {d.direction==='provided'?adminT("LOAN PROVIDED"):adminT("LOAN RECEIVED")}</p><h1>{d.title}</h1>
  <span className={s.badge}>{adminT(label(d.status))}</span><span className={s.badge}>{adminT(label(d.review_state))}</span><span className={s.badge}>{adminT("Admin only")}{process.env.VERCEL_ENV === 'preview' ? adminT(" · Staging") : ''}</span>
  {query.notice&&<p className={s.notice} role={query.notice==='saved'?'status':'alert'}>{query.notice==='saved'?adminT("Saved successfully."):adminT("The change could not be confirmed. Check the submitted details and permissions, then reload before retrying.")}</p>}
  <dl className={s.facts}>{[['Original principal',money(d.principal, adminLocale)],['Annual interest',Number(d.annual_rate)+'%'],['Lender',d.lender],['Borrower',d.borrower],['Agreement date',date(d.agreement_date, adminLocale)],['Funding date (source)',date(d.start_date, adminLocale)],['Maturity',date(d.maturity_date, adminLocale)],['Currency','EUR']].map(([a,b])=><div key={a}><dt>{adminT(a)}</dt><dd>{b}</dd></div>)}</dl>
  {query.mail&&<p className={s.notice} role="status">{query.mail==='sent'?adminT("Notification accepted by the mail server. Inbox delivery is not yet confirmed."):adminT("Access saved. Email queued; delivery has not been confirmed. Preview email delivery is disabled.")}</p>}
  <p className={s.notice}>{adminT("Original principal is a contractual figure, not a reconciled outstanding balance. A schedule, due date or source deposit entry does not confirm that money was received or paid.")}</p>
  <section className={s.section}><h2>{adminT("Terms & source review")}</h2><p className={s.notes}>{d.notes||adminT("No additional terms recorded.")}</p><h3>{adminT("Source references")}</h3><p className={s.notes}>{d.source_reference||adminT("Not yet recorded.")}</p><details><summary>{adminT("Edit deal details")}</summary><DealForm deal={d} entities={entitiesResult.error?[]:(entitiesResult.data||[])}/></details></section>
  <section className={s.section}><h2>{adminT("Payment schedule")}</h2><p>{d.direction==='provided'?adminT("Expected receipts from the borrower."):adminT("Expected payments to the lender.")}  {adminT("Amounts and dates are entered from the supplied schedule; no automatic interest calculation is applied.")}</p>
   {!complete?<p role="alert">{adminT("The complete schedule/payment history could not be loaded. Payment actions and totals are unavailable.")}</p>:<>
   <div className={s.facts}><div><dt>{adminT("Scheduled interest")}</dt><dd>{money(entries.filter(x=>x.kind==='interest').reduce((a,x)=>a+Number(x.amount),0), adminLocale)}</dd></div><div><dt>{adminT("Confirmed cash receipts / payments")}</dt><dd>{money(payments.filter(x=>!x.is_void).reduce((a,x)=>a+Number(x.amount),0), adminLocale)}</dd></div><div><dt>{adminT("Past due, not confirmed")}</dt><dd>{entries.filter(x=>x.due_date<today&&(x.kind==='interest'?(interest.byId.get(x.id)?.remaining??Number(x.amount)):Math.round((Number(x.amount)-paidFor(x.id,payments))*100)/100)>0).length}  {adminT("instalments")}</dd></div></div>
   <p>{adminT("“Not confirmed” may mean payment has occurred but has not yet been reconciled here. It is not a declaration of arrears.")}</p>
   <p className={s.notice}>{adminT("Interest advances first clear the oldest unpaid interest (including prior shortfalls), then upcoming instalments. Credits reduce amounts due without recording the cash twice.")}</p>
   {interest.credits.length>0&&<div className={s.card}><h3>{adminT("Interest carryforward allocations")}</h3>
    {interest.credits.map((a,index)=><p key={index}>{money(a.amount, adminLocale)}  {adminT("received for")} {date(entries.find(x=>x.id===a.sourceId)?.due_date||null, adminLocale)}  {adminT("applied to interest due")} {date(entries.find(x=>x.id===a.targetId)?.due_date||null, adminLocale)}</p>)}
   </div>}
   {interest.unappliedCredit>0&&<p className={s.notice}>{adminT("Unallocated interest advance:")} {money(interest.unappliedCredit, adminLocale)}{adminT(". Add a future interest term before the excess can be allocated.")}</p>}
   {entries.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Due / source period")}</th><th>{adminT("Type")}</th><th>{adminT("Planned")}</th><th>{adminT("Confirmed")}</th><th>{adminT("Record receipt / payment")}</th></tr></thead><tbody>{entries.map(i=>{
    const allocation=i.kind==='interest'?interest.byId.get(i.id):null;
    const paid=paidFor(i.id,payments);
    const remaining=allocation?.remaining??Math.round((Number(i.amount)-paid)*100)/100;
    // The main figure is the amount settled against this obligation, not just
    // the cash receipt allocated directly to the source period.
    const settled=allocation?Math.min(Number(i.amount),Math.max(0,Number(i.amount)-remaining)):paid;
    return <tr key={i.id}><td>{date(i.due_date, adminLocale)}<small>{i.period_label}</small><small>{i.note}</small></td><td>{adminT(label(i.kind))}</td><td>{money(i.amount, adminLocale)}</td><td><strong>{money(settled, adminLocale)}</strong>{allocation&&allocation.creditApplied>0&&<><small>{adminT("Directly received:")} {money(paid, adminLocale)}</small><small>{adminT("Interest credit applied:")} {money(allocation.creditApplied, adminLocale)}</small></>}{allocation&&allocation.excessFromThisTerm>0&&<small>{adminT("Excess receipt:")} {money(allocation.excessFromThisTerm, adminLocale)}  {adminT("· applied elsewhere:")} {money(allocation.creditDistributed, adminLocale)}</small>}<small>{remaining===0?adminT("Fully settled (including credit)"):settled>0?adminT("Partially settled"):adminT("Not confirmed")}</small><small>{adminT("Still due:")} {money(remaining, adminLocale)}</small></td><td>{remaining>0?<details><summary>{adminT("Confirm")} {d.direction==='provided'?adminT("receipt"):adminT("payment")}</summary><form action={recordPayment} className={s.inline}>
     <input type="hidden" name="deal_id" value={id}/><input type="hidden" name="instalment_id" value={i.id}/><input type="hidden" name="payment_id" value={randomUUID()}/>
     <label>{adminT("Actual amount (EUR)")}<input name="amount" aria-label={adminT("Actual amount")} type="number" required min="0.01" max={i.kind==='interest'?undefined:remaining} step="0.01" defaultValue={remaining}/></label>
     {i.kind==='interest'&&<p className={s.notes}>{adminT("Interest receipts may exceed this term’s balance within the total unpaid schedule. Surplus offsets older shortfalls, then future interest.")}</p>}
     <label>{adminT("Actual payment date")}<input name="paid_on" type="date" required max={today}/></label>
     <label>{adminT("Evidence / bank reference")}<input name="reference" required minLength={2} maxLength={300}/></label>
     <button>{adminT("Record confirmed payment")}</button></form></details>:adminT("Complete")}</td></tr>;
   })}</tbody></table></div>:<p className={s.empty}>{adminT("No scheduled instalments yet.")}</p>}
   <details><summary>{adminT("Add a scheduled instalment")}</summary><form action={addInstalment} className={s.form}>
    <input type="hidden" name="deal_id" value={id}/><label>{adminT("Type")}<select name="kind"><option value="interest">{adminT("Interest")}</option><option value="principal">{adminT("Principal repayment")}</option><option value="fee">{adminT("Fee")}</option></select></label>
    <label>{adminT("Source period / label")}<input name="period_label" maxLength={120}/></label><label>{adminT("Due date")}<input name="due_date" type="date" required/></label><label>{adminT("Amount (EUR)")}<input name="amount" type="number" min="0.01" step="0.01" required/></label>
    <label className={s.wide}>{adminT("Source note")}<input name="note" maxLength={1000}/></label><p className={s.wide}>{adminT("This adds a planned obligation, not a confirmed payment. Existing source schedule entries are retained.")}</p><button>{adminT("Add planned instalment")}</button>
   </form></details>
   <h3>{adminT("Confirmed payment history")}</h3>{payments.length?payments.map(p=><div className={s.card} key={p.id}><strong>{money(p.amount, adminLocale)} · {date(p.paid_on, adminLocale)} {p.is_void?adminT("· VOID"):''}</strong><p>{p.reference}</p>{p.is_void?<p>{adminT("Correction reason:")} {p.void_reason}</p>:<>{entries.find(x=>x.id===p.instalment_id)?.kind==='interest'&&<details><summary>{adminT("Correct this interest receipt")}</summary>
    <form action={correctInterestReceipt} className={s.inline}>
     <input type="hidden" name="deal_id" value={id}/>
     <input type="hidden" name="payment_id" value={p.id}/>
     <input type="hidden" name="replacement_id" value={randomUUID()}/>
     <input type="hidden" name="expected_amount" value={Number(p.amount).toFixed(2)}/>
     <label>{adminT("Actual bank receipt (EUR)")}<input name="corrected_amount" type="number" required min="0.01" step="0.01" defaultValue={Number(p.amount).toFixed(2)}/></label>
     <label>{adminT("Bank reference / correction reason")}<input name="correction_reason" required minLength={5} maxLength={450} placeholder={adminT("Correct to actual received amount")}/></label>
     <p>{adminT("This voids and replaces the incorrect entry atomically, retaining its payment date and bank reference. Both changes remain in the audit log.")}</p>
     <button>{adminT("Confirm audited correction")}</button>
    </form>
   </details>}
   <details><summary>{adminT("Void an incorrect record")}</summary><form action={voidPayment} className={s.inline}><input type="hidden" name="deal_id" value={id}/><input type="hidden" name="payment_id" value={p.id}/><label>{adminT("Required correction reason")}<input name="void_reason" minLength={3} maxLength={500} required/></label><button>{adminT("Void record and retain history")}</button></form></details></>}</div>):<p>{adminT("No payments have been confirmed in this module.")}</p>}
   </>}
  </section>
  <section className={s.section}><h2>{adminT("Agreements & documents")}</h2><p>{adminT("Retained document versions for full administrators only. Downloads open in a new tab using short-lived private links.")}</p>{docs.error||docs.count!==(docs.data||[]).length?<p role="alert">{adminT("Document list could not be loaded completely.")}</p>:<Documents dealId={id} documents={docs.data as LoanDocument[]}/>}</section>
  <ClientAccess dealId={id} grants={(access.data||[]) as ClientGrant[]} relationships={(relationships.data||[]) as AccessRelationship[]} complete={!access.error&&!relationships.error&&access.count===(access.data||[]).length&&relationships.count===(relationships.data||[]).length}/>
  <section className={s.section}><h2>{adminT("Activity history")}</h2><p>{adminT("Latest 30 recorded changes. Complete records are retained in the audit store.")}</p>{audit.error?<p role="alert">{adminT("History unavailable.")}</p>:<ul>{(audit.data||[]).map(a=><li key={a.id}>{date(a.created_at, adminLocale)} · {a.table_name.replace('mzs_capital_','')} · {adminT(a.action.toLowerCase())} · {a.actor_id?adminT("Administrator {p0}", {p0: a.actor_id.slice(0,8)}):adminT("Controlled source import")}{a.new_record?.is_void?adminT(" · payment voided"):''}</li>)}</ul>}</section>
 </>;
}
