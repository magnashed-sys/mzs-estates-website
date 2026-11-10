export type CapitalReminder = {
  instalment_id: string; deal_id: string; due_date: string;
  recipient_email: string; recipient_name: string; lender: string;
  title: string; amount: number; credit: number; locale: 'en' | 'nl';
};
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function capitalReminderMessage(s: CapitalReminder) {
  if (!['en', 'nl'].includes(s.locale) || !Number.isFinite(s.amount) || s.amount <= 0 ||
    !Number.isFinite(s.credit) || s.credit < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(s.due_date) ||
    !/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(s.recipient_email) ||
    [s.recipient_name, s.lender, s.title].some(v => !v || /[\r\n]/.test(v))) throw Error('Invalid reminder snapshot');
  const nl = s.locale === 'nl';
  const locale = nl ? 'nl-NL' : 'en-GB';
  const date = new Intl.DateTimeFormat(locale, {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(s.due_date + 'T12:00:00Z'));
  const money = (n: number) => new Intl.NumberFormat(locale, {style: 'currency', currency: 'EUR'}).format(n);
  const subject = nl ? `Vriendelijke herinnering – rentebetaling ${date}` : `Friendly reminder – interest payment ${date}`;
  const paragraphs = nl ? [
    `Beste ${s.recipient_name},`,
    `Een vriendelijke herinnering aan de komende rentebetaling voor ${s.title}, met betaaldatum ${date}.`,
    `Volgens onze administratie resteert voor deze termijn ${money(s.amount)}.${s.credit > 0 ? ` Het eerdere tegoed van ${money(s.credit)} is hierin al verrekend.` : ''}`,
    'Wil je ervoor zorgen dat de betaling volgens onze afspraak wordt voldaan?',
    'Heb je inmiddels betaald, dan hartelijk dank en kun je deze herinnering als afgehandeld beschouwen.',
    'Met vriendelijke groet,\nMZS Group',
  ] : [
    `Dear ${s.recipient_name},`,
    `A friendly reminder of the upcoming interest payment for ${s.title}, with a payment date of ${date}.`,
    `According to our records, the remaining amount for this instalment is ${money(s.amount)}.${s.credit > 0 ? ` This already includes the credit of ${money(s.credit)} carried forward from earlier payments.` : ''}`,
    'Could you please arrange payment in line with our agreement?',
    'If you have already made the payment, thank you and please disregard this reminder.',
    'Kind regards,\nMZS Group',
  ];
  return {subject, text: paragraphs.join('\n\n'), html: `<!doctype html><html lang="${s.locale}"><body style="margin:0;background:#f4f1eb;font-family:Arial,sans-serif;color:#25231e"><div style="max-width:600px;margin:24px auto;padding:28px;background:#fff;border-top:3px solid #ad925c"><p style="color:#897044;letter-spacing:3px;font-size:12px">MZS GROUP</p>${paragraphs.map(p => `<p style="line-height:1.6">${escape(p).replace(/\n/g, '<br>')}</p>`).join('')}</div></body></html>`};
}
