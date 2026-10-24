/** Presentation-only snapshot. Never determines recipients, permissions or delivery. */
export function russianRentalMail(kind: 'requested' | 'confirmed' | 'modified' | 'cancelled', booking: {
  property: string; checkIn: string; checkOut: string; guests: number; total: number;
  reference: string; heating?: boolean; notes?: string;
}, site: string) {
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
  const date = (s: string) => new Intl.DateTimeFormat('ru-RU', {dateStyle:'long',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
  const titles = {requested:'Ваша заявка на бронирование получена', confirmed:'Ваше бронирование подтверждено', modified:'Ваше бронирование изменено', cancelled:'Ваше бронирование отменено'};
  const intro = {
    requested:'Мы получили вашу заявку. Бронирование ещё не подтверждено. После индивидуального рассмотрения и одобрения MZS Group отправит отдельное подтверждение.',
    confirmed:'MZS Group одобрила и подтвердила ваше бронирование. Будем рады приветствовать вас.',
    modified:'MZS Group изменила ваше подтверждённое бронирование. Указанные ниже сведения заменяют данные предыдущего подтверждения.',
    cancelled:'MZS Group отменила ваше бронирование. Предыдущее подтверждение больше не действует. Не планируйте поездку на основании этого подтверждения.',
  };
  const status = {requested:'ЗАЯВКА — НЕ ПОДТВЕРЖДЕНО', confirmed:'ПОДТВЕРЖДЕНО', modified:'ПОДТВЕРЖДЕНО — ИЗМЕНЕНО', cancelled:'ОТМЕНЕНО — НЕДЕЙСТВИТЕЛЬНО'};
  const rows: [string,string][] = [
    ['Статус',status[kind]], ['Объект',booking.property], ['Заезд',date(booking.checkIn)], ['Выезд',date(booking.checkOut)],
    ['Ночей',String(Math.round((Date.parse(booking.checkOut)-Date.parse(booking.checkIn))/86400000))], ['Гостей',String(booking.guests)],
    [kind==='requested'?'Ориентировочная сумма':kind==='cancelled'?'Ранее подтверждённая сумма':'Подтверждённая сумма',new Intl.NumberFormat('ru-RU',{style:'currency',currency:'EUR'}).format(booking.total)],
    ['Номер бронирования',booking.reference],
  ];
  if (kind==='requested') {
    if (booking.heating !== undefined) rows.push(['Запрошен подогрев бассейна',booking.heating?'Да':'Нет']);
    rows.push(['Особые пожелания',booking.notes || 'Нет']);
  }
  const footer = kind==='cancelled'?'Вопросы оплаты и возврата средств решаются отдельно. За помощью обращайтесь в MZS Group.':'Актуальный статус доступен в вашем личном кабинете. За помощью обращайтесь в MZS Group.';
  const link=site+'/private/reservations';
  return {
    subject:titles[kind]+' | MZS Group',
    text:['Здравствуйте!',intro[kind],...rows.map(([k,v])=>k+': '+v),footer,link,'MZS Group'].join('\n\n'),
    html:`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0b0b0a;color:#eeeae2;font-family:Arial,sans-serif"><div style="max-width:580px;margin:28px auto;padding:32px 24px;background:#151411;border:1px solid #514839;overflow-wrap:anywhere"><p style="text-align:center;color:#d5c09a">MZS GROUP</p><h1 style="font:normal 30px Georgia,serif;color:#eeeae2!important">${titles[kind]}</h1><p style="color:#eeeae2!important">Здравствуйте!</p><p style="line-height:1.8;color:#eeeae2!important">${intro[kind]}</p><table style="width:100%">${rows.map(([k,v])=>`<tr><td style="padding:10px;color:#d5c09a!important">${escape(k)}</td><td style="padding:10px;color:#eeeae2!important;background-color:#151411">${escape(v)}</td></tr>`).join('')}</table><p style="line-height:1.8;color:#eeeae2!important">${footer}</p><p style="margin:32px 0"><a style="display:inline-block;background:#d5c09a;color:#111!important;padding:16px;text-decoration:none" href="${escape(link)}">ОТКРЫТЬ БРОНИРОВАНИЕ →</a></p><p style="font-size:11px;color:#d5c09a">ЧАСТНАЯ · НЕЗАВИСИМАЯ · МЕЖДУНАРОДНАЯ</p></div></body></html>`,
  };
}
