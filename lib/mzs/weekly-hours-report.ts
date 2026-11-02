import {madridParts} from './visitor-report';
export const hoursRecipient='magdy@mzsgroup.eu';
export const hoursQueue='https://www.mzsgroup.com/admin/workspaces/estates/actions?queue=visits';
const dayOffset=(day:string,n:number)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function hoursWindow(now:Date){
 const p=madridParts(now);
 if(p.hour!==7||new Date(p.day+'T12:00:00Z').getUTCDay()!==1)return null;
 return {week:dayOffset(p.day,-7),sunday:dayOffset(p.day,-1)};
}
export function workMonday(day:string){
 const d=new Date(day+'T12:00:00Z');return dayOffset(day,-((d.getUTCDay()+6)%7));
}
export type HoursEntry={id:string;profile_id:string;name:string;location:string;unit:string|null;worked_on:string;created_at:string;actual_minutes:number;effective_minutes:number;description:string;review_decision:string|null;correction_pending:boolean};
const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const duration=(n:number)=>`${Math.floor(n/60)} uur ${String(n%60).padStart(2,'0')} min`;
const stamp=(s:string)=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'}).format(new Date(s));
export function weeklyHoursReport(week:string,rows:HoursEntry[]){
 if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!Number.isSafeInteger(r.actual_minutes)||r.actual_minutes<0||!Number.isSafeInteger(r.effective_minutes)||r.effective_minutes<0))throw Error('Invalid hours data');
 const subject=`MZS Group | Ingediende uren | ${week} t/m ${dayOffset(week,6)}`;
 const total=rows.reduce((n,r)=>n+r.actual_minutes,0);
 const groups=new Map<string,HoursEntry[]>();for(const r of rows)groups.set(r.profile_id,[...(groups.get(r.profile_id)||[]),r]);
 const text=[subject,`${rows.length} registraties · totaal werkelijk geregistreerd: ${duration(total)}`,'Ingediend in de voorgaande kalenderweek (Europe/Madrid). Werkdatum apart vermeld. Geen facturatie-afronding. Beoordelingsstatus op het moment van samenstellen.'];
 let details='';
 for(const [id,entries] of groups){
 const heading=`${entries[0].name} — ${duration(entries.reduce((n,r)=>n+r.actual_minutes,0))}`;text.push('',heading);
 const lines=entries.map(r=>{
 const status=({approved:'Goedgekeurd',rejected:'Afgewezen'} as Record<string,string>)[r.review_decision??'']??'Nog te beoordelen';
 const line=`Werkdatum ${r.worked_on}${r.worked_on<week?' (later ingediend)':''} · ingediend ${stamp(r.created_at)} · ${r.location}${r.unit?' / '+r.unit:''} · geregistreerd ${duration(r.actual_minutes)} · effectief ${duration(r.effective_minutes)} · ${status}${r.correction_pending?' · Open correctie':''} — ${r.description}`;
 text.push(line);return `<p style="line-height:1.6;border-bottom:1px solid #ddd;padding-bottom:12px">${esc(line)}</p>`;
 }).join('');
 const links=[...new Set(entries.map(r=>workMonday(r.worked_on)))].sort().map(w=>{
 const url=`https://www.mzsgroup.com/admin/workspaces/estates/weekly?profile=${encodeURIComponent(id)}&week=${w}`;
 text.push(`Beoordeel werkweek ${w}: ${url}`);return `<p><a href="${esc(url)}">Beoordeel werkweek ${esc(w)}</a></p>`;
 }).join('');
 details+=`<h2 style="font-size:19px">${esc(heading)}</h2>${lines}${links}`;
 }
 if(!rows.length){text.push('Geen uren ingediend in deze periode.');details='<p>Geen uren ingediend in deze periode.</p>';}
 text.push('',`Alle te beoordelen uren: ${hoursQueue}`);
 return {subject,text:text.join('\n'),html:`<!doctype html><html lang="nl"><body style="margin:0;background:#f4f1eb;font-family:Arial,sans-serif;color:#25231e"><div style="max-width:720px;margin:24px auto;padding:28px;background:#fff"><p style="color:#897044;letter-spacing:4px">MZS GROUP</p><h1 style="font-size:25px">Ingediende uren</h1><p>${esc(week)} t/m ${esc(dayOffset(week,6))}</p><p><strong>${rows.length} registraties · ${esc(duration(total))}</strong></p><p style="line-height:1.6">${esc(text[2])}</p>${details}<p><a href="${esc(hoursQueue)}">Alle te beoordelen uren</a></p><p>De beoordelingslinks vereisen je bestaande MZS-login.</p></div></body></html>`};
}
