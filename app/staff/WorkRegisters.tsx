
import {useAdminI18n} from '../../lib/admin/i18n';
import Link from 'next/link';
import PhotoPanel from './PhotoPanel';
import {statusLabels,type Property,type Member} from '../../lib/property-operations/staff-work';
import type {PropertyTask} from '../../lib/property-operations/property-tasks';
import {type loadRegisters,type Params,one} from '../../lib/property-operations/staff-data';
import {ReviewForm,CorrectionForm,CorrectionDecisionForm,TicketProgressForm} from './WorkForms';
import s from './staff.module.css';
import type {StaffLanguage} from '../../lib/property-operations/staff-copy';
import type {AdminTranslator} from '../../lib/admin/translation';
const staffHistoryLabels:Record<'nl'|'es',Record<string,string>>={
 nl:{
  'Filter by property':'Filter op pand','All assigned properties':'Alle toegewezen panden',
  'Show records':'Registraties tonen','My work visits':'Mijn urenregistraties',
  'My maintenance reports':'Mijn onderhoudsmeldingen','Date / property':'Datum / pand',
  'Minutes':'Minuten','Review':'Beoordeling','Details':'Details',
  'Open work visit':'Open urenregistratie','No work visits recorded yet.':'Nog geen uren geregistreerd.',
  'Maintenance register':'Onderhoudsregister','Property / report':'Pand / melding',
  'Status':'Status','Planning':'Planning','Open report':'Open melding',
  'No maintenance reports yet.':'Nog geen onderhoudsmeldingen.',
  'Not yet scheduled':'Nog niet ingepland','Time entry pages':'Pagina’s urenregistratie',
  'Maintenance pages':'Pagina’s onderhoud','← Previous':'← Vorige','Next →':'Volgende →',
  'Page':'Pagina','of':'van','records':'registraties','Property':'Pand',
  'Correction history':'Correctiegeschiedenis','Review history':'Beoordelingsgeschiedenis',
  'Not yet reviewed.':'Nog niet beoordeeld.','No corrections requested.':'Geen correcties aangevraagd.',
  'Work visit ·':'Werkbezoek ·','Originally:':'Oorspronkelijk:',
  'minutes':'minuten','approved':'goedgekeurd','rejected':'afgewezen',
  'Awaiting review':'Wacht op beoordeling','Returned':'Afgewezen','Approved':'Goedgekeurd',
  'Originally':'Oorspronkelijk','Explanation:':'Toelichting:',
  'Work performed':'Uitgevoerde werkzaamheden','Related task':'Gekoppelde taak',
  'Latest':'Laatste update','Maintenance photos':'Onderhoudsfoto’s'
 },
 es:{
  'Filter by property':'Filtrar por inmueble','All assigned properties':'Todos los inmuebles asignados',
  'Show records':'Mostrar registros','My work visits':'Mis horas registradas',
  'My maintenance reports':'Mis incidencias de mantenimiento','Date / property':'Fecha / inmueble',
  'Minutes':'Minutos','Review':'Revisión','Details':'Detalles',
  'Open work visit':'Abrir registro de horas','No work visits recorded yet.':'Todavía no hay horas registradas.',
  'Maintenance register':'Registro de mantenimiento','Property / report':'Inmueble / incidencia',
  'Status':'Estado','Planning':'Planificación','Open report':'Abrir incidencia',
  'No maintenance reports yet.':'Todavía no hay incidencias.',
  'Not yet scheduled':'Sin programar','Time entry pages':'Páginas de horas',
  'Maintenance pages':'Páginas de mantenimiento','← Previous':'← Anterior','Next →':'Siguiente →',
  'Page':'Página','of':'de','records':'registros','Property':'Inmueble',
  'Correction history':'Historial de correcciones','Review history':'Historial de revisiones',
  'Not yet reviewed.':'Sin revisar.','No corrections requested.':'Sin correcciones solicitadas.',
  'Work visit ·':'Visita ·','Originally:':'Originalmente:',
  'minutes':'minutos','approved':'aprobado','rejected':'rechazado',
  'Awaiting review':'Pendiente de revisión','Returned':'Devuelto','Approved':'Aprobado',
  'Originally':'Originalmente','Explanation:':'Explicación:',
  'Work performed':'Trabajo realizado','Related task':'Tarea relacionada',
  'Latest':'Última actualización','Maintenance photos':'Fotos de mantenimiento'
 }
};

type Data=Awaited<ReturnType<typeof loadRegisters>>;
export default function WorkRegisters({data,params,properties,tasks=[],members=[],assignees=members,admin=false,staffLanguage}:{data:Data;params:Params;properties:Property[];tasks?:PropertyTask[];members?:Member[];assignees?:Member[];admin?:boolean;staffLanguage?:StaffLanguage}){
 const {t:baseT,locale:adminLocale}=useAdminI18n();
 const adminT:AdminTranslator=(source,values)=>{
  if(admin||!staffLanguage||staffLanguage==='en'||source===null||source===undefined)
   return baseT(source,values);
  const literal=String(source);
  const translated=staffHistoryLabels[staffLanguage]?.[literal];
  return translated&&!values?translated:baseT(source,values);
 };

 const base=admin?'/admin/workspaces/estates/staff':'/staff';
 const url=(key:string,value:string,anchor='')=>{const q=new URLSearchParams();for(const k of ['property','vpage','tpage','visit','ticket','inbox','inboxPage','reportFrom','reportUntil','reportProperty','reportProfile','reportPage']){const v=one(params[k]);if(v)q.set(k,v);}q.set(key,value);return base+'?'+q.toString()+anchor;};
 const property=(id:string)=>properties.find(p=>p.id===id)?.name??adminT("Property");
 const person=(id:string|null)=>members.find(m=>m.id===id)?.full_name??adminT(id?"Assigned staff member":"Not yet assigned");
 const taskName=(id:string|null|undefined)=>id?(tasks.find(t=>t.id===id)?.title??'Linked task'):'No specific task';
 const status=(v:Data['visits']['rows'][number])=>v.correction_pending?"Correction awaiting review":v.review_decision==='approved'?"Approved":v.review_decision==='rejected'?"Returned":"Awaiting review";
 const pager=(key:string,p:{page:number;total:number})=><nav className={s.pagination} aria-label={key==='vpage'?adminT("Time entry pages"):adminT("Maintenance pages")}>{p.page>1&&<Link href={url(key,String(p.page-1))}>{adminT("← Previous")}</Link>}<span>{adminT("Page")} {p.page}  {adminT("of")} {Math.max(1,Math.ceil(p.total/25))} · {p.total}  {adminT("records")}</span>{p.page*25<p.total&&<Link href={url(key,String(p.page+1))}>{adminT("Next →")}</Link>}</nav>;
 return <>
 <form className={s.filter} method="get"><label>{adminT("Filter by property")}<select name="property" defaultValue={data.property??''}><option value="">{adminT("All assigned properties")}</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button>{adminT("Show records")}</button></form>
 <section className={s.panel}><h2>{admin?adminT("Time register"):adminT("My work visits")}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Date / property")}</th>{admin&&<th>{adminT("Staff member")}</th>}<th>{adminT("Minutes")}</th><th>{adminT("Review")}</th><th>{adminT("Details")}</th></tr></thead><tbody>{data.visits.rows.map(v=><tr key={v.id}><td>{v.worked_on}<br/>{property(v.property_id)}{v.task_id&&<small> · {taskName(v.task_id)}</small>}</td>{admin&&<td>{person(v.profile_id)}</td>}<td>{v.effective_minutes}{v.actual_minutes!==v.effective_minutes&&<small>  {adminT("· originally")} {v.actual_minutes}</small>}</td><td>{adminT(status(v))}</td><td><Link href={url('visit',v.id,'#visit')}>{adminT("Open work visit")}</Link></td></tr>)}</tbody></table></div>{!data.visits.total&&<p>{adminT("No work visits recorded yet.")}</p>}{pager('vpage',data.visits)}</section>
 {data.visit&&<section id="visit" className={s.panel}><h2>{adminT("Work visit ·")} {data.visit.worked_on} · {property(data.visit.property_id)}</h2><p>{data.visit.description}</p>{data.visit.task_id&&<p>Related task: {taskName(data.visit.task_id)}</p>}<p>{adminT("Originally:")} <strong>{data.visit.actual_minutes}  {adminT("minutes")}</strong>  {adminT("· current duration:")} <strong>{data.visit.effective_minutes}  {adminT("minutes")}</strong> · {adminT(status(data.visit))}</p>{data.visit.review_reason&&<p>{adminT("Explanation:")} {data.visit.review_reason}</p>}
 {admin&&!data.visit.review_decision&&!data.visit.correction_pending&&<ReviewForm key={data.visit.correction_id??data.visit.id} visit={data.visit}/>}
 {!admin&&!data.visit.correction_pending&&<CorrectionForm key={data.visit.correction_id??data.visit.id} visit={data.visit}/>}
 <h3>{adminT("Correction history")}</h3>{!data.corrections.length&&<p>{adminT("No corrections requested.")}</p>}{data.corrections.map(c=>{const decision=data.decisions.find(d=>d.correction_id===c.id);return <article className={s.history} key={c.id}><p>{c.created_at.slice(0,10)}  {adminT("· proposed:")} {c.proposed_minutes}  {adminT("minutes ·")} {decision?(decision.decision==='approved'?adminT("approved"):adminT("rejected")):adminT("pending")}</p><p>{c.reason}</p>{decision&&<p>{adminT("Decision:")} {decision.reason}</p>}{admin&&!decision&&<CorrectionDecisionForm id={c.id}/>}</article>;})}
 <h3>{adminT("Review history")}</h3>{!data.reviews.length&&<p>{adminT("Not yet reviewed.")}</p>}{data.reviews.map(r=><article className={s.history} key={r.id}><p>{r.reviewed_at.slice(0,10)} · {r.reviewed_minutes}  {adminT("minutes ·")} {r.decision==='approved'?adminT("approved"):adminT("returned")}</p><p>{r.reason}</p>{admin&&<p>{adminT("Reviewed by")} {person(r.reviewed_by??null)}  {adminT("· separate recharge proposal:")} {r.billable_minutes??0}  {adminT("minutes (not yet invoiced)")}</p>}</article>)}</section>}
 <section className={s.panel}><h2>{admin?adminT("Maintenance register"):adminT("My maintenance reports")}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Property / report")}</th><th>{adminT("Status")}</th><th>{adminT("Planning")}</th><th>{adminT("Details")}</th></tr></thead><tbody>{data.tickets.rows.map(t=><tr key={t.id}><td>{property(t.property_id)}<br/>{t.title}{t.priority==='urgent'&&<strong>  {adminT("· Urgent")}</strong>}</td><td>{adminT(statusLabels[t.status])}</td><td>{t.scheduled_for??adminT("Not yet scheduled")}{admin&&<><br/>{person(t.responsible_profile_id)}</>}</td><td><Link href={url('ticket',t.id,'#ticket')}>{adminT("Open report")}</Link></td></tr>)}</tbody></table></div>{!data.tickets.total&&<p>{adminT("No maintenance reports yet.")}</p>}{pager('tpage',data.tickets)}</section>
 {data.ticket&&<section id="ticket" className={s.panel}><h2>{data.ticket.title} · {property(data.ticket.property_id)}</h2><p>{data.ticket.description}</p><p>{adminT(statusLabels[data.ticket.status])} · {data.ticket.scheduled_for??adminT("Not yet scheduled")}{admin&&' · '+person(data.ticket.responsible_profile_id)}</p>{admin&&<TicketProgressForm key={data.ticket.id+data.ticket.status+data.ticket.latest_note} ticket={data.ticket} members={assignees.filter(m=>m.is_active)}/>}<PhotoPanel ticketId={data.ticket.id} photos={data.photos} admin={admin}/><h3>{adminT("Status history")}</h3>{!data.events.length&&<p>{adminT("The report is awaiting review.")}</p>}{data.events.map(e=><article className={s.history} key={e.id}><p>{e.created_at.slice(0,10)} · {adminT(statusLabels[e.action])}{e.scheduled_for&&adminT(' · scheduled {p0}',{p0:e.scheduled_for})}</p><p>{e.note}</p></article>)}</section>}
 </>;
}
