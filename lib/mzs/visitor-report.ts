/** Presentation only. Never store query strings, fragments, form input or tokens. */
export function visitorPath(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 250 || /[?#%\\]/.test(input)) return null;
  const path = input.replace(/^\/(nl|es|ru|de|it|fr|pt-BR|ar|tr|lt|pl|zh-CN|sv|ro|nb|da|uk|fi|cs)(?=\/|$)/, '') || '/';
  if (['/', '/real-estate', '/private-capital', '/private', '/private/profile', '/private/reservations', '/private/capital'].includes(path)) return path;
  return /^\/private\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) ? path : null;
}

export function madridParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Madrid', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return {day:`${get('year')}-${get('month')}-${get('day')}`, hour:+get('hour'),minute:+get('minute')};
}
function madridInstant(day: string, hour: number, minute: number) {
  // Noon/23:30 are never ambiguous or nonexistent at Madrid DST transitions.
  const nominal = Date.parse(`${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
  const p = madridParts(new Date(nominal));
  return new Date(nominal - ((p.hour-hour+24)%24*60+p.minute-minute)*60000).toISOString();
}
export function reportWindow(now: Date) {
  const p = madridParts(now);
  if (p.hour !== 0) return null;
  const previous = new Date(Date.parse(p.day+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  return {day:previous, start:madridInstant(previous,0,0), end:madridInstant(p.day,0,0)};
}
const escape = (v: unknown) => String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const clock = (v: string) => new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
export type VisitorSummary = {name:string;email:string;role:string;period:string;kind:string;path:string;total:number;first:string;last:string};
export function visitorReport(day: string, rows: VisitorSummary[], installedAt: string) {
  const lines = rows.map(r=>`${r.name || r.email} (${r.email}; ${r.role}) | ${r.kind==='login'?'Inloggen':r.path} | ${r.total}× | ${clock(r.first)}–${clock(r.last)}`);
  const note = 'Tijden: Europe/Madrid. Volledige voorgaande kalenderdag, van 00.00 tot 00.00 uur. Paginabezoeken zijn browsermeldingen, geen bewijs dat inhoud is gelezen. Activiteit met een bestaande sessie is ook opgenomen. Geen bezoektijden van vóór de start van registratie.';
  const subject = `MZS Group | Bezoekersoverzicht ${day}`;
  const text = [subject,note,`Registratie gestart: ${installedAt}`, '',...(lines.length?lines:['Geen geregistreerde activiteit in deze periode.'])].join('\n');
  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#0b0b0a;color:#eeeae2;font-family:Arial,sans-serif"><div style="max-width:680px;margin:24px auto;padding:24px;background:#151411"><p style="color:#d5c09a;letter-spacing:4px">MZS GROUP</p><h1 style="font-size:25px;color:#eeeae2">Bezoekersoverzicht ${escape(day)}</h1><p style="color:#eeeae2;line-height:1.6">${escape(note)}</p><p style="color:#d5c09a">Registratie gestart: ${escape(installedAt)}</p>${lines.length?lines.map(line=>`<p style="padding:12px;border-bottom:1px solid #514839;overflow-wrap:anywhere;color:#eeeae2">${escape(line)}</p>`).join(''):'<p style="color:#eeeae2">Geen geregistreerde activiteit in deze periode.</p>'}</div></body></html>`;
  return {subject,text,html};
}
