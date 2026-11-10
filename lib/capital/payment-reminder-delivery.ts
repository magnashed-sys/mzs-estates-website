import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {capitalReminderMessage, type CapitalReminder} from './payment-reminder';

export async function deliverCapitalReminders(instalmentId?: string) {
  const e = process.env;
  if (e.MZS_CAPITAL_REMINDERS_ENABLED !== 'true' || e.MZS_CAPITAL_DEALS_ENABLED !== 'true' ||
    e.VERCEL_ENV !== 'production' || e.NEXT_PUBLIC_SUPABASE_URL !== 'https://ptrnjzmcehrhbsfxntgw.supabase.co') return {status: 'disabled'};
  const host = e.MZS_SMTP_HOST || e.SMTP_HOST, port = Number(e.MZS_SMTP_PORT || e.SMTP_PORT || 587);
  const user = e.MZS_SMTP_USER || e.SMTP_USER, pass = e.MZS_SMTP_PASSWORD || e.SMTP_PASSWORD;
  const sender = e.MZS_CAPITAL_REMINDER_FROM, copy = e.MZS_CAPITAL_REMINDER_COPY;
  const email = /^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/;
  if (!e.SUPABASE_SERVICE_ROLE_KEY || !host || !user || !pass || !sender || !copy ||
    !email.test(sender) || !email.test(copy) || ![465,587].includes(port)) return {status: 'not_configured'};
  const from = {name: 'MZS Group', address: sender};
  const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
  const {data: ids, error} = await db.rpc('mzs_due_capital_reminders');
  if (error || !Array.isArray(ids)) throw Error('Reminder queue unavailable');
  const mailer = nodemailer.createTransport({host, port, secure: port === 465, requireTLS: port === 587,
    auth: {user, pass}, tls: {minVersion: 'TLSv1.2'}, connectionTimeout: 8000, greetingTimeout: 6000, socketTimeout: 10000});
  let accepted = 0, cancelled = 0, requiresReview = 0;
  const started = Date.now();
  try {
    await mailer.verify();
    for (const id of ids.filter(id => !instalmentId || id === instalmentId)) {
      if (Date.now() - started > 35000) break; // Leave unclaimed items for the next run.
      const {data: snapshot, error: claimError} = await db.rpc('mzs_claim_capital_reminder', {p_instalment_id: id});
      if (claimError) {requiresReview++; continue;}
      if (!snapshot) continue;
      let status = 'uncertain';
      const deliveryResult = {from: sender, copy, recipient: snapshot.recipient_email,
        recipientAccepted: false, copyAccepted: false, messageId: `<capital-reminder-${id}@notifications.mzsgroup.com>`};
      try {
        const message = capitalReminderMessage(snapshot as CapitalReminder);
        // Recheck payments, recipient, opt-in and authorization immediately before SMTP.
        const {data: current, error: currentError} = await db.rpc('mzs_capital_reminder_snapshot', {p_instalment_id: id});
        if (currentError) status = 'uncertain';
        else if (!current || Object.keys(snapshot).some(k => snapshot[k] !== current[k])) status = 'cancelled';
        else {
          const receipt = await mailer.sendMail({...message, from, to: current.recipient_email, bcc: copy,
            messageId: deliveryResult.messageId});
          const accepted = (address: string) => !!receipt.accepted?.some((a: string | {address: string}) =>
            (typeof a === 'string' ? a : a.address).toLowerCase() === address.toLowerCase());
          deliveryResult.recipientAccepted = accepted(current.recipient_email);
          deliveryResult.copyAccepted = accepted(copy);
          status = deliveryResult.recipientAccepted && deliveryResult.copyAccepted ? 'accepted' :
            deliveryResult.recipientAccepted || deliveryResult.copyAccepted ? 'uncertain' : 'failed';
        }
      } catch {status = 'uncertain';}
      const {data: saved, error: saveError} = await db.rpc('mzs_finish_capital_reminder', {p_instalment_id: id, p_status: status, p_delivery_result: deliveryResult});
      if (saveError || saved !== true || !['accepted','cancelled'].includes(status)) requiresReview++;
      else if (status === 'accepted') accepted++;
      else cancelled++;
    }
  } finally {mailer.close();}
  return {status: requiresReview ? 'requires_review' : 'complete', accepted, cancelled, requiresReview};
}
