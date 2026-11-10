import {redirect} from 'next/navigation';
import {requireDealsAdmin} from '../../../../../lib/security/capital-deals';
import {deliverCapitalReminders} from '../../../../../lib/capital/payment-reminder-delivery';
import s from './deals.module.css';

async function sendReminder(form: FormData) {
 'use server';
 const {db} = await requireDealsAdmin();
 const id = String(form.get('instalment_id') || '');
 if (!/^[0-9a-f-]{36}$/i.test(id) || form.get('confirmed') !== 'yes') return;
 const {data: term, error} = await db.from('mzs_capital_instalments').select('deal_id').eq('id', id).single();
 if (error || !term) return;
 let result = 'requires_review';
 try {result = (await deliverCapitalReminders(id)).status;} catch {}
 redirect(`/admin/group/capital/deals/${term.deal_id}?reminder=${encodeURIComponent(result)}#payment-reminders`);
}

export default async function ReminderPanel({dealId, notice}: {dealId: string; notice?: string}) {
 const {db} = await requireDealsAdmin();
 const settings = await db.from('mzs_capital_reminder_settings').select('enabled,recipient_email,first_due_date').eq('deal_id', dealId).maybeSingle();
 if (settings.error || !settings.data) return null;
 const schedule = await db.from('mzs_capital_instalments').select('id,due_date').eq('deal_id',dealId).eq('kind','interest').order('due_date').limit(500);
 if (schedule.error) return <p>Payment reminder history is unavailable.</p>;
 const ids = (schedule.data || []).map(t => t.id);
 const history = ids.length ? await db.from('mzs_capital_reminder_deliveries').select('instalment_id,status,completed_at,delivery_result').in('instalment_id',ids).limit(500) : {data:[],error:null};
 if (history.error) return <p>Payment reminder history is unavailable.</p>;
 const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const until = new Date(Date.parse(today+'T12:00:00Z')+5*86400000).toISOString().slice(0,10);
 return <section id="payment-reminders" className={s.section}><h2>Payment reminders</h2>
  <p>{settings.data.enabled?'Automatic reminders enabled: five days before the payment date.':'Automatic reminders paused.'}</p>
  <p>From: MZS Group &lt;{process.env.MZS_CAPITAL_REMINDER_FROM}&gt;<br/>To: {settings.data.recipient_email}<br/>BCC copy: {process.env.MZS_CAPITAL_REMINDER_COPY}</p>
  {notice && <p role="status">{notice==='complete'?'Processing complete. Check the delivery history below.':notice==='disabled'?'Reminders are currently disabled.':'Delivery requires review. Do not resend until the outcome has been checked.'}</p>}
  <p>Paid terms are skipped. A reminder already processed is not sent again. Acceptance below refers to the mail server.</p>
  {(schedule.data||[]).filter(t=>t.due_date>=settings.data!.first_due_date).map(t=>{
   const sent=history.data?.find(h=>h.instalment_id===t.id);
   return <div className={s.card} key={t.id}><strong>Payment date: {t.due_date}</strong>
    {sent?<p>Status: {sent.status}. Recipient accepted: {sent.delivery_result?.recipientAccepted?'Yes':'No'}. Copy accepted: {sent.delivery_result?.copyAccepted?'Yes':'No'}.</p>:
     settings.data!.enabled&&t.due_date>today&&t.due_date<=until?<form action={sendReminder}>
      <input type="hidden" name="instalment_id" value={t.id}/>
      <label><input type="checkbox" name="confirmed" value="yes" required/> I approve sending this reminder and the BCC copy.</label>
      <button>Send payment reminder</button>
     </form>:<p>Not yet due for a reminder.</p>}
   </div>;
  })}
 </section>;
}
