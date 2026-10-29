
import {getAdminI18n} from '../../../../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID,createHash} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../../../../lib/security/estate-properties';
import {loadInvoiceRegister,invoiceSources} from '../../../../../../../../lib/finance/invoice-register';
import {loadFollowUps,invoiceKey,aging,ages,reminderText,type Reminder} from '../../../../../../../../lib/finance/receivables';
import {operationsDay} from '../../../../../../../../lib/property-operations/action-queues';
import {allRows} from '../../../../../../../../lib/property-operations/staff-data';
import {invoiceMailMode} from '../../../../../../../../lib/estates/invoice-delivery';
import {FollowUpForm,ReminderForm} from '../../Forms';
import s from '../../../sales.module.css';
export const dynamic='force-dynamic';
export default async function FollowUp({params}:{params:Promise<{source:string;id:string}>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin(),{source,id}=await params;
 if(!Object.hasOwn(invoiceSources,source)||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))notFound();
 const [invoices,history]=await Promise.all([loadInvoiceRegister(db,null),loadFollowUps(db)]),invoice=invoices.find(i=>i.source===source&&i.id===id);if(!invoice)notFound();
 const notes=history.rows.filter(r=>r.source===source&&r.invoice_id===id).sort((a,b)=>b.revision-a.revision),latest=history.latest.get(invoiceKey(invoice));
 const {data,error}=await db.rpc('mzs_invoice_reminder_context',{p_source:source,p_invoice:id});if(error)throw Error('Reminder eligibility could not be verified.');
 const reminder=data as Reminder|null;
 const requests=await allRows<{id:string;created_at:string;snapshot:Reminder}>((a,b)=>db.from('mzs_invoice_reminders').select('id,created_at,snapshot',{count:'exact'}).eq('source',source).eq('invoice_id',id).order('id').range(a,b));
 const results=new Map<string,string>();for(let n=0;n<requests.length;n+=100){const ids=requests.slice(n,n+100).map(r=>r.id);const rows=await allRows<{id:string;status:string}>((a,b)=>db.from('mzs_invoice_reminder_results').select('id,status',{count:'exact'}).in('id',ids).order('id').range(a,b));for(const r of rows)results.set(r.id,r.status);}
 const blocked=requests.some(r=>!results.has(r.id)||results.get(r.id)==='uncertain'||Date.parse(r.created_at)>Date.now()-86400000);
 let mode:string|null=null;try{mode=invoiceMailMode();}catch{}
 const money=(c:number)=>new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(c/100),message=reminder?reminderText(reminder):null;
 return <section className={s.page}><Link href="/admin/workspaces/accountancy/sales/receivables">{adminT("← Receivables")}</Link><header className={s.heading}><div><p className={s.eyebrow}>{invoice.issuer}</p><h1>{invoice.number}</h1><p>{invoice.customer} · {adminT(ages[aging(invoice,operationsDay())])} · {invoice.balance===null?adminT("Balance unknown"):money(invoice.balance)}</p></div><Link className={s.button} href={invoice.href}>{adminT("Invoice / payments →")}</Link></header>
 <FollowUpForm key={latest?.revision??0} source={source} invoiceId={id} requestId={randomUUID()} revision={latest?.revision??0} nextOn={latest?.next_on??null}/>
 <h2>{adminT("Follow-up history")}</h2>{!notes.length&&<p>{adminT("No internal follow-up recorded yet.")}</p>}{notes.map(n=><article className={s.paymentForm} key={n.id}><strong>{adminT("Revision")} {n.revision} · {new Date(n.created_at).toLocaleString(adminLocale,{timeZone:'Europe/Madrid'})}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{n.note}</p><p>{n.next_on?adminT("Next follow-up: {p0}", {p0: n.next_on}):adminT("No follow-up date planned")}</p></article>)}
 <section className={s.paymentForm}><h2>{adminT("Payment reminder")}</h2>{reminder&&message?<><p>{adminT("To:")} <strong>{reminder.email}</strong>  {adminT("· registered customer contact")}</p><p>{adminT("Subject:")} {message.subject}</p><pre style={{whiteSpace:'pre-wrap',font:'inherit'}}>{message.text}</pre><p>{adminT("No attachment. This reminder refers to the original invoice. Review recent bank receipts before sending.")}</p>{mode==='capture'&&<p>{adminT("Staging capture: no external email will be sent.")}</p>}{!mode&&<p>{adminT("Email delivery is disabled in this environment.")}</p>}{blocked&&<p>{adminT("A recent, pending or uncertain reminder blocks another send. Check the delivery history and mail logs.")}</p>}<ReminderForm source={source} invoiceId={id} requestId={randomUUID()} preview={createHash('sha256').update(JSON.stringify(data)).digest('hex')} enabled={!!mode&&!blocked&&reminder.balance_cents===invoice.balance}/></>:<p>{adminT("A reminder requires a known positive overdue balance, a verified customer link and one valid customer email. Booking schedules and older rental invoices require follow-up through their dossier; unknown payments must be verified first.")}</p>}</section>
 <h2>{adminT("Reminder history")}</h2>{!requests.length&&<p>{adminT("No reminders requested.")}</p>}{requests.sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString(adminLocale,{timeZone:'Europe/Madrid'})} · {r.snapshot.email} · {money(r.snapshot.balance_cents)} · <strong>{results.get(r.id)??adminT("Pending / outcome not confirmed")}</strong></p>)}<p className={s.notes}>{adminT("Accepted means accepted by the mail server, not confirmed delivery. Captured means a staging test. Uncertain or unfinished requests must be investigated before further contact. At most one reminder per invoice every 24 hours.")}</p></section>;
}
