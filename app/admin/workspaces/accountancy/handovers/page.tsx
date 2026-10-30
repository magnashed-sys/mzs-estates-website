import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {archiveEntities} from '../../../../../lib/accountancy/archive-data';
import {annualSource} from '../../../../../lib/accountancy/administration-data';
import {completenessItems} from '../../../../../lib/accountancy/completeness';
import type {SupplierIdentity} from '../../../../../lib/accountancy/supplier-integrity';
import type {Year} from '../../../../../lib/accountancy/administration';
import {HANDOVER_ROOT,handoverLabels,type Handover,type Question,type HandoverEvent} from '../../../../../lib/accountancy/handover';
import {HandoverForm,QuestionForm} from './Forms';
import s from '../administrations/administration.module.css';
import h from './handover.module.css';
export const dynamic='force-dynamic';
export default async function Handovers({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db}=await requireEstateAdmin(),{language,locale}=await getAdminI18n(),q=await searchParams,es=language==='es',tr=(en:string,spanish:string)=>es?spanish:en;
 const [entities,years,handovers,questions]=await Promise.all([
 archiveEntities(db),allRows<Year>((a,b)=>db.from('mzs_accountancy_years').select('*',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b)),
 allRows<Handover>((a,b)=>db.from('mzs_accountancy_handovers').select('*',{count:'exact'}).order('year_id').range(a,b)),
 allRows<Question>((a,b)=>db.from('mzs_accountancy_handover_questions').select('*',{count:'exact'}).order('id').range(a,b))]);
 const selected=years.find(y=>y.id===q.administration),value=handovers.find(x=>x.year_id===selected?.id),ownQuestions=questions.filter(x=>x.year_id===selected?.id).sort((a,b)=>Number(a.status==='resolved')-Number(b.status==='resolved')||(a.due_on??'9999').localeCompare(b.due_on??'9999')||a.id.localeCompare(b.id));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let current:{items:number;missing:number;followups:number}|null=null,events:HandoverEvent[]=[],historyFailed=false;
 const actors=new Map<string,string>();
 if(selected){
  try{const [source,suppliers,tasks]=await Promise.all([annualSource(db,selected.id),allRows<SupplierIdentity>((a,b)=>db.from('mzs_lease_relationships').select('id,name,kind,company_details',{count:'exact'}).order('id').range(a,b)),allRows<{status:string}>((a,b)=>db.from('mzs_accountancy_followups').select('status',{count:'exact'}).eq('year_id',selected.id).order('id').range(a,b))]);const items=completenessItems(source,suppliers);current={items:items.length,missing:items.filter(x=>x.issues.includes('missing_original')).length,followups:tasks.filter(t=>!['done','cancelled'].includes(t.status)).length};}catch{current=null;}
  const history=await db.from('mzs_accountancy_handover_events').select('*').eq('year_id',selected.id).order('id',{ascending:false}).limit(50);historyFailed=!!history.error;events=history.data??[];
  const ids=[...new Set(events.map(e=>e.actor_id))];if(ids.length){const people=await db.from('profiles').select('id,full_name').in('id',ids);for(const p of people.data??[])actors.set(p.id,p.full_name||tr('Administrator','Administrador'));}
 }
 const entityName=(id:string)=>entities.find(e=>e.id===id)?.name??id;
 const label=(status:unknown)=>typeof status==='string'&&Object.hasOwn(handoverLabels,status)?handoverLabels[status as keyof typeof handoverLabels][es?1:0]:status==='resolved'?tr('Resolved','Resuelta'):status==='open'?tr('Open','Abierta'):tr('Not started','Sin iniciar');
 const stamp=(date:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(date));
 return <section className={s.page}><Link href="/admin/workspaces/accountancy">← Accountancy</Link><header className={s.heading}><div><h1>{tr('Accountant handovers','Entregas al asesor')}</h1><p>{tr('Track each entity’s annual handover, delivery reference and accountant questions.','Controle la entrega anual de cada entidad, su referencia y las preguntas del asesor.')}</p></div></header>
 <div className={s.tableWrap}><table className={s.table}><thead><tr>{[tr('Entity / year','Entidad / ejercicio'),tr('Status','Estado'),tr('Accountant','Asesor'),tr('Handed over','Entregado'),tr('Open questions','Preguntas abiertas')].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{years.map(y=>{const v=handovers.find(x=>x.year_id===y.id);return <tr key={y.id}><td><Link href={HANDOVER_ROOT+'?administration='+y.id}>{entityName(y.issuer_id)} · {y.fiscal_year}</Link></td><td>{label(v?.status)}</td><td>{v?.accountant||'—'}</td><td>{v?.delivered_on||'—'}</td><td>{questions.filter(x=>x.year_id===y.id&&x.status==='open').length}</td></tr>;})}</tbody></table></div>
 {!years.length&&<p>{tr('Create a year administration first.','Cree primero una administración anual.')} <Link href="/admin/workspaces/accountancy/administrations">{tr('Year administrations','Administraciones anuales')}</Link></p>}
 {!selected?<p>{tr('Select an entity and year above to manage its handover.','Seleccione una entidad y ejercicio para gestionar su entrega.')}</p>:<>
 <h2>{entityName(selected.issuer_id)} · {selected.fiscal_year}</h2>
 <nav className={h.links}><Link href={'/admin/workspaces/accountancy/administrations/'+selected.id}>{tr('Open administration','Abrir administración')}</Link><a href={'/admin/workspaces/accountancy/administrations/'+selected.id+'/export'}>{tr('Download current year package','Descargar paquete anual actual')}</a><Link href={'/admin/workspaces/accountancy/completeness?administration='+selected.id}>{tr('Resolve documents and follow-up tasks','Revisar documentos y tareas de seguimiento')}</Link></nav>
 {current?<div className={s.metrics}><p>{tr('Current checks needing attention','Controles actuales pendientes')}<strong>{current.items}</strong></p><p>{tr('Original PDFs missing','PDF originales pendientes')}<strong>{current.missing}</strong></p><p>{tr('Open follow-up tasks','Tareas de seguimiento abiertas')}<strong>{current.followups}</strong></p><p>{tr('Open accountant questions','Preguntas abiertas del asesor')}<strong>{ownQuestions.filter(x=>x.status==='open').length}</strong></p></div>:<p role="alert">{tr('Current document checks could not be loaded. No completeness result is available.','No se pudieron cargar los controles actuales. No hay resultado de integridad disponible.')}</p>}
 <p className={s.notice}>{tr('Checks reflect registered data now, not the contents of a previously delivered package. A readiness or completion status is your administrative decision; outstanding checks remain visible. Each download creates the current package. Keep the exact delivered copy and record its reference.','Los controles reflejan los datos registrados actuales, no el contenido de un paquete entregado anteriormente. Marcar como listo o finalizado es una decisión administrativa; los controles pendientes siguen visibles. Cada descarga genera el paquete actual. Conserve la copia entregada y registre su referencia.')}</p>
 <section className={s.card}><h2>{tr('Handover progress','Progreso de la entrega')}</h2>{value&&<p>{label(value.status)} · {stamp(value.updated_at)}</p>}<HandoverForm key={selected.id+':'+(value?.revision??0)} year={selected.id} value={value} es={es} today={today}/></section>
 <h2>{tr('Accountant questions','Preguntas del asesor')}</h2>
 {value?.status==='completed'?<p>{tr('Reopen the handover before adding or reopening questions.','Reabra la entrega antes de añadir o reabrir preguntas.')}</p>:<details className={s.card}><summary>{tr('Add a question','Añadir una pregunta')}</summary><QuestionForm key={'new:'+selected.id+':'+ownQuestions.length} year={selected.id} id={randomUUID()} es={es}/></details>}
 {!ownQuestions.length&&<p>{tr('No accountant questions recorded.','No hay preguntas registradas.')}</p>}
 {ownQuestions.map(x=><article className={h.question} key={x.id}><strong className={h.tag}>{label(x.status)}</strong>{x.due_on&&<span className={x.status==='open'&&x.due_on<today?h.overdue:''}> · {tr('Follow up','Seguimiento')}: {x.due_on}{x.status==='open'&&x.due_on<today?' · '+tr('Overdue','Vencido'):''}</span>}<p>{x.question}</p>{x.answer&&<p>{x.answer}</p>}<details><summary>{tr('Edit / resolve question','Editar / resolver pregunta')}</summary><QuestionForm key={x.revision} year={selected.id} id={x.id} value={x} es={es}/></details></article>)}
 <details className={s.card}><summary>{tr('Change history · latest 50','Historial de cambios · últimos 50')}</summary>{historyFailed?<p role="alert">{tr('History unavailable. Refresh to retry.','Historial no disponible. Actualice para reintentar.')}</p>:events.length?events.map(e=><article className={h.question} key={e.id}><p>{stamp(e.created_at)} · {e.kind==='handover'?tr('Handover','Entrega'):tr('Question','Pregunta')} · {label(e.before_record?.status)} → {label(e.after_record.status)}</p><p className={h.history}>{e.kind==='handover'?[e.after_record.accountant,e.after_record.delivered_on,e.after_record.package_reference,e.after_record.note].filter(Boolean).join('\n'):[e.after_record.question,e.after_record.answer,e.after_record.due_on].filter(Boolean).join('\n')}</p><small>{tr('Recorded by','Registrado por')}: {actors.get(e.actor_id)||tr('Administrator','Administrador')} · #{e.id}</small></article>):<p>{tr('No changes recorded.','Sin cambios registrados.')}</p>}</details>
 </>}
 </section>;
}
