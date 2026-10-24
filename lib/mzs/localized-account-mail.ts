/** Client-facing copy only. Authorization, claiming and delivery stay in notifications.ts. */
const copy = {
  ru: {
    member: 'клиент', dear: 'Здравствуйте,', access: 'ЛИЧНЫЙ ДОСТУП',
    confidential: 'Это личное сообщение предназначено указанному получателю. Не пересылайте сообщения о безопасности аккаунта.',
    motto: 'ЧАСТНАЯ · НЕЗАВИСИМАЯ · МЕЖДУНАРОДНАЯ', invitation: 'ТОЛЬКО ПО ПРИГЛАШЕНИЮ',
    projects: 'Доступные вам проекты', login: 'ВОЙТИ В ЛИЧНЫЙ КАБИНЕТ', collection: 'ОТКРЫТЬ МОЮ КОЛЛЕКЦИЮ', capital: 'ОТКРЫТЬ PRIVATE CAPITAL',
    account_activated: ['Ваш аккаунт MZS Group активирован', 'Добро пожаловать в вашу личную коллекцию.', 'Ваш аккаунт MZS Group одобрен и активирован. Теперь вы можете просматривать предложения, отобранные для вас.'],
    new_project_access: ['Новый доступ к частным проектам | MZS Group', 'Новые возможности в вашей коллекции.', 'Вашему аккаунту MZS Group предоставлен дополнительный доступ к частным проектам.'],
    capital_access_granted: ['Ваш доступ к Private Capital | MZS Group', 'Ваше личное досье доступно.', 'Вашему аккаунту MZS Group предоставлен доступ к досье Private Capital. Войдите в аккаунт для безопасного просмотра.'],
    types: {investment: 'Инвестиции', financing: 'Финансирование', sale: 'Частная продажа', rental: 'Частная аренда'},
  },
  nl: {
    member: 'relatie', dear: 'Beste', access: 'PRIVATE TOEGANG',
    confidential: 'Dit persoonlijke bericht is bestemd voor de genoemde ontvanger. Stuur berichten over accountbeveiliging niet door.',
    motto: 'PRIVAAT · ONAFHANKELIJK · INTERNATIONAAL', invitation: 'UITSLUITEND OP UITNODIGING',
    projects: 'Uw toegewezen projecten', login: 'PERSOONLIJK INLOGGEN', collection: 'MIJN COLLECTIE BEKIJKEN', capital: 'PRIVATE CAPITAL OPENEN',
    account_activated: ['Uw MZS Group-account is nu actief', 'Welkom bij uw persoonlijke collectie.', 'Uw MZS Group-account is goedgekeurd en geactiveerd. U kunt nu de voor u geselecteerde mogelijkheden bekijken.'],
    new_project_access: ['Nieuwe private projecttoegang | MZS Group', 'Nieuwe mogelijkheden in uw collectie.', 'Uw MZS Group-account heeft aanvullende toegang tot private projecten gekregen.'],
    capital_access_granted: ['Uw Private Capital-toegang | MZS Group', 'Uw persoonlijke dossier is beschikbaar.', 'Uw MZS Group-account heeft toegang gekregen tot een Private Capital-dossier. Log in om uw overzicht veilig te bekijken.'],
    types: {investment: 'Investeren', financing: 'Financiering', sale: 'Private verkoop', rental: 'Private verhuur'},
  },
  es: {
    member: 'miembro', dear: 'Estimado/a', access: 'ACCESO PRIVADO',
    confidential: 'Este mensaje privado está dirigido al destinatario indicado. No reenvíe mensajes sobre la seguridad de su cuenta.',
    motto: 'PRIVADO · INDEPENDIENTE · INTERNACIONAL', invitation: 'SOLO POR INVITACIÓN',
    projects: 'Sus proyectos asignados', login: 'ACCESO PRIVADO', collection: 'EXPLORAR MI COLECCIÓN', capital: 'ABRIR PRIVATE CAPITAL',
    account_activated: ['Su cuenta de MZS Group ya está activa', 'Le damos la bienvenida a su colección privada.', 'Su cuenta de MZS Group se ha aprobado y activado. Ya puede acceder a las oportunidades seleccionadas para usted.'],
    new_project_access: ['Nuevo acceso a proyectos privados | MZS Group', 'Nuevas oportunidades en su colección.', 'Se ha concedido a su cuenta de MZS Group acceso adicional a proyectos privados.'],
    capital_access_granted: ['Su acceso a Private Capital | MZS Group', 'Su expediente privado está disponible.', 'Se ha concedido a su cuenta de MZS Group acceso a un expediente de Private Capital. Inicie sesión para consultar su resumen de forma segura.'],
    types: {investment: 'Inversión', financing: 'Financiación', sale: 'Venta privada', rental: 'Alquiler privado'},
  },
} as const;
const clientEvents = ['account_activated', 'new_project_access', 'capital_access_granted'] as const;
export function isClientMail(type: string): type is typeof clientEvents[number] {
  return (clientEvents as readonly string[]).includes(type);
}
function escape(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []; }
export function localizedAccountMail(event: {event_type: string; payload: Record<string,unknown>}, recipientName: string, locale: 'nl'|'es'|'ru', site: string) {
  if (!isClientMail(event.event_type)) throw Error('Unsupported localized client notification');
  const c = copy[locale], [subject, headline, intro] = c[event.event_type];
  const name = recipientName.trim().split(/\s+/)[0] || c.member;
  let link = site + '/' + locale + '/login', action: string = c.login;
  let details: string[] = [];
  if (event.event_type === 'account_activated') {
    const projects = strings(event.payload.projects);
    if (projects.length) details = [c.projects, ...projects];
  } else if (event.event_type === 'new_project_access') {
    const project = typeof event.payload.project === 'string' ? event.payload.project : '';
    const types = strings(event.payload.added_types).map(t => Object.hasOwn(c.types,t) ? c.types[t as keyof typeof c.types] : t);
    details = [project, ...types].filter(Boolean);
    link = site + '/private'; action = c.collection;
  } else {
    // Never include financial data, project names or other payload fields for capital mail.
    link = site + '/private/capital'; action = c.capital;
  }
  const html = `<!DOCTYPE html><html lang="${locale}"><body style="margin:0;background:#0b0b0a;color:#f4f0e7;font-family:Arial,Helvetica,sans-serif"><div style="max-width:590px;margin:40px auto;padding:40px 30px;background:#11100e;border:1px solid #3d3529;overflow-wrap:anywhere"><div style="text-align:center;color:#d5c09a;font-family:Georgia,serif;font-size:35px;letter-spacing:5px">MZS</div><div style="text-align:center;letter-spacing:5px;font-size:10px;color:#d0c6b8;margin:10px 0 35px">GROUP</div><p style="text-align:center;letter-spacing:3px;color:#d5c09a;font-size:11px">${c.access}</p><h1 style="font-family:Georgia,serif;font-weight:normal;text-align:center;font-size:33px">${headline}</h1><p style="line-height:1.9;color:#d0c6b8">${c.dear} ${escape(name)},</p><p style="line-height:1.9;color:#d0c6b8">${intro}</p>${details.map(d=>`<p style="color:#d5c09a;line-height:1.9">${escape(d)}</p>`).join('')}<p style="margin:40px 0;text-align:center"><a href="${escape(link)}" style="display:inline-block;background:#d5c09a;color:#0b0b0a;padding:18px 24px;text-decoration:none;letter-spacing:1px;font-size:12px;font-weight:bold">${action} →</a></p><p style="font-size:11px;color:#aaa398;line-height:1.9;text-align:center">${c.confidential}</p><hr style="border:0;border-top:1px solid #514839;margin:30px 0"/><p style="text-align:center;font-size:10px;color:#d5c09a;letter-spacing:2px">${c.motto}</p><p style="text-align:center;font-size:11px;color:#aaa398">MZS GROUP · ${c.invitation}</p></div></body></html>`;
  return {subject, html, text: `${c.dear} ${name},\n\n${intro}\n\n${details.join('\n')}\n\n${action}: ${link}\n\n${c.confidential}\n\nMZS Group`};
}
