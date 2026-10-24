import copy from './rental-mail-copy.json';
import {russianRentalMail} from './russian-rental-mail';
type Locale = keyof typeof copy | 'ru';
export function isLocalizedRentalLocale(locale: unknown): locale is Locale {
  return typeof locale === 'string' && (locale === 'ru' || Object.hasOwn(copy, locale));
}
/** Presentation only. Callers retain recipient lookup, permissions, claims and delivery policy. */
export function localizedRentalMail(kind: 'requested'|'confirmed'|'modified'|'cancelled', booking: {
  property:string; checkIn:string; checkOut:string; guests:number; total:number;
  reference:string; heating?:boolean; notes?:string;
}, site:string, locale:Locale) {
  if (locale === 'ru') return russianRentalMail(kind, booking, site);
  const c=copy[locale], l=c.labels, rtl=locale==='ar';
  const escape=(s:string)=>s.replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]!));
  const date=(s:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
  const number=(n:number)=>new Intl.NumberFormat(locale).format(n);
  const rows:[string,string][]=[
    [l.status,c.status[kind]],[l.property,booking.property],[l.checkIn,date(booking.checkIn)],[l.checkOut,date(booking.checkOut)],
    [l.nights,number(Math.round((Date.parse(booking.checkOut)-Date.parse(booking.checkIn))/86400000))],[l.guests,number(booking.guests)],
    [kind==='requested'?l.estimate:kind==='cancelled'?l.previous:l.confirmed,new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(booking.total)],
    [l.reference,booking.reference],
  ];
  if(kind==='requested') {
    if(booking.heating!==undefined)rows.push([l.heating,booking.heating?c.yes:c.no]);
    rows.push([l.notes,booking.notes||c.none]);
  }
  const footer=kind==='cancelled'?c.cancelFooter:c.footer, link=site+'/private/reservations';
  return {
    subject:c.title[kind]+' | MZS Group',
    text:[c.greeting,c.intro[kind],...rows.map(([k,v])=>k+': '+v),footer,link,'MZS Group'].join('\n\n'),
    html:`<!doctype html><html lang="${locale}" dir="${rtl?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0b0b0a;color:#eeeae2;font-family:Arial,sans-serif"><div style="max-width:580px;margin:28px auto;padding:32px 24px;background:#151411;border:1px solid #514839;overflow-wrap:anywhere"><p dir="ltr" style="text-align:center;color:#d5c09a">MZS GROUP</p><h1 style="font-weight:normal;font-size:30px;color:#eeeae2!important">${c.title[kind]}</h1><p style="color:#eeeae2!important">${c.greeting}</p><p style="line-height:1.8;color:#eeeae2!important">${c.intro[kind]}</p><table role="presentation" style="width:100%">${rows.map(([k,v])=>`<tr><td style="padding:10px;color:#d5c09a!important">${escape(k)}</td><td style="padding:10px;color:#eeeae2!important;background-color:#151411"><bdi>${escape(v)}</bdi></td></tr>`).join('')}</table><p style="line-height:1.8;color:#eeeae2!important">${footer}</p><p style="margin:32px 0"><a style="display:inline-block;background:#d5c09a;color:#111!important;padding:16px;text-decoration:none" href="${escape(link)}">${c.action} ${rtl?'←':'→'}</a></p><p style="font-size:11px;color:#d5c09a">${c.motto}</p></div></body></html>`,
  };
}
