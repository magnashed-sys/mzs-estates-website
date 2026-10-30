import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {operationsDay,loadQueueCounts,queueHref} from '../../../../../lib/property-operations/action-queues';
import {staffTaskEnvironment,type PropertyTask} from '../../../../../lib/property-operations/property-tasks';
import {operationsSnapshot,type OperationsTicket,type OperationsVisit,type OperationsStaffNote,type OperationsItem} from '../../../../../lib/property-operations/operations-cockpit';
import s from './operations.module.css';
export const dynamic='force-dynamic';
export default async function OperationsCockpit(){
 requireStaffEnvironment();
 if(!staffTaskEnvironment())notFound();
 const {db}=await requireEstateAdmin();
 const {language}=await getAdminI18n();
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const today=operationsDay();
 const [tasks,tickets,visits,notes,properties,areas,units,people,queues]=await Promise.all([
  allRows<PropertyTask>((a,b)=>db.from('mzs_ops_current_property_tasks').select('*',{count:'exact'}).order('id').range(a,b)),
  allRows<OperationsTicket>((a,b)=>db.from('mzs_ops_current_tickets').select('id,property_id,unit_id,title,priority,status,scheduled_for,responsible_profile_id,created_at,latest_note',{count:'exact'}).order('id').range(a,b)),
  allRows<OperationsVisit>((a,b)=>db.from('mzs_ops_current_visits').select('id,profile_id,property_id,work_area_id,worked_on,effective_minutes,description,review_decision,correction_pending',{count:'exact'}).order('id').range(a,b)),
  allRows<OperationsStaffNote>((a,b)=>db.from('mzs_ops_staff_ticket_notes').select('id,ticket_id,note_kind,note,created_at',{count:'exact'}).order('id').range(a,b)),
  allRows<{id:string;name:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
  allRows<{id:string;name:string}>((a,b)=>db.from('mzs_ops_staff_work_areas').select('id,name',{count:'exact'}).order('id').range(a,b)),
  allRows<{id:string;address:string}>((a,b)=>db.from('mzs_estate_units').select('id,address',{count:'exact'}).order('id').range(a,b)),
  allRows<{id:string;full_name:string|null}>((a,b)=>db.from('profiles').select('id,full_name',{count:'exact'}).order('id').range(a,b)),
  loadQueueCounts(db,today)
 ]);
 const data=operationsSnapshot({tasks,tickets,visits,notes,properties,areas,units,people,today});
 const stats=[
  {title:tr('Open tasks','Tareas abiertas'),value:data.summary.taskOpen,href:'#tasks'},
  {title:tr('Blocked tasks','Tareas bloqueadas'),value:data.summary.taskBlocked,href:'#tasks'},
  {title:tr('Overdue tasks','Tareas vencidas'),value:data.summary.taskOverdue,href:'#tasks'},
  {title:tr('Open maintenance','Mantenimiento abierto'),value:data.summary.maintenanceOpen,href:'#maintenance'},
  {title:tr('Needs triage','Por revisar'),value:data.summary.maintenanceTriage,href:'#maintenance'},
  {title:tr('Time to review','Horas por revisar'),value:data.summary.timePending,href:'#time'},
  {title:tr('Time corrections','Correcciones horarias'),value:data.summary.timeCorrection,href:'#corrections'}
 ];
 const itemCard=(item:OperationsItem)=>{
  const status=item.subtitle==='Blocked'?tr('Blocked','Bloqueada'):
   item.subtitle==='Overdue'?tr('Overdue','Vencida'):
   item.subtitle==='Staff blocked'?tr('Staff blocked','Personal bloqueado'):
   item.subtitle==='Needs triage'?tr('Awaiting review','Pendiente de revisión'):
   item.subtitle==='Ready for review'?tr('Ready for review','Lista para revisión'):
   item.subtitle==='Planning overdue'?tr('Planning overdue','Planificación vencida'):
   item.subtitle==='Correction requested'?tr('Correction requested','Corrección solicitada'):
   item.subtitle==='Awaiting review'?tr('Awaiting review','Pendiente de revisión'):
   item.subtitle;
  return <article className={s.item} key={item.kind+item.id}>
   <div className={s.itemHead}><strong>{item.title}</strong><span className={item.priority==='urgent'?s.urgent:item.priority==='attention'?s.attention:s.neutral}>{status}</span></div>
   <p className={s.location}>{item.location}</p>
   <p className={s.detail}>{item.detail}</p>
   <div className={s.itemFoot}><span>{item.date??tr('Not planned','Sin planificar')}</span><Link href={item.href} prefetch={false}>{tr('Open dossier','Abrir expediente')}</Link></div>
  </article>;
 };
 const block=(id:string,title:string,description:string,items:OperationsItem[],href:string,viewAll:string)=>
  <section className={s.section} id={id} aria-labelledby={id+'-heading'}>
   <div className={s.sectionHead}><div><h2 id={id+'-heading'}>{title}</h2><p>{description}</p></div>
   <Link href={href} prefetch={false}>{viewAll}</Link></div>
   {items.length?<div className={s.itemGrid}>{items.slice(0,9).map(itemCard)}</div>:
    <p className={s.empty}>{tr('No actions currently require attention in this section.','No hay acciones pendientes en esta sección.')}</p>}
   {items.length>9&&<p className={s.note}>{tr('Showing 9 of','Mostrando 9 de')} {items.length}. {tr('Use the full register for the rest.','Use el registro completo para ver el resto.')}</p>}
  </section>;
 const alertQueues=queues.filter(q=>q.key==='budgets'||q.key==='overdue'||q.key==='planning'||q.key==='closure'||q.key==='today');
 return <main className={s.root}>
  <header className={s.hero}>
   <div><p className={s.kicker}>MZS GROUP · OPERATIONS</p>
    <h1>{tr('Operations Cockpit','Panel de operaciones')}</h1>
    <p>{tr('One place for open tasks, maintenance, staff follow-up and time reviews. Live administrative records, not estimates.','Un único panel para tareas abiertas, mantenimiento, seguimiento del personal y revisión de horas. Registros reales, no estimaciones.')}</p></div>
   <form method="get" className={s.refresh}><button>{tr('Refresh overview','Actualizar panel')}</button>
    <span>{tr('As of','Actualizado al')} {today} · Europe/Madrid</span></form>
  </header>
  <nav className={s.quick} aria-label={tr('Operations navigation','Navegación de operaciones')}>
   <a href="#tasks">{tr('Tasks','Tareas')}</a><a href="#maintenance">{tr('Maintenance','Mantenimiento')}</a>
   <a href="#time">{tr('Time reviews','Revisión de horas')}</a><a href="#corrections">{tr('Corrections','Correcciones')}</a>
  </nav>
  <section className={s.metrics} aria-label={tr('Open workflow counts','Conteos de trabajos pendientes')}>
   {stats.map(x=><a key={x.title} className={s.metric} href={x.href}><small>{x.title}</small><strong>{x.value}</strong></a>)}
  </section>
  <section className={s.shortcuts} aria-label={tr('Action queues','Bandejas de acciones')}>
   <h2>{tr('Administrative action queues','Bandejas de acciones administrativas')}</h2>
   <div className={s.queueGrid}>{alertQueues.map(q=><Link key={q.key} href={queueHref(q.key)} prefetch={false}>
    <span>{tr(q.key==='budgets'?'Budget approvals':q.key==='overdue'?'Overdue maintenance':q.key==='planning'?'Complete planning':q.key==='closure'?'Confirm resolution':'Scheduled today',
       q.key==='budgets'?'Aprobación de presupuestos':q.key==='overdue'?'Mantenimiento vencido':q.key==='planning'?'Completar planificación':q.key==='closure'?'Confirmar resolución':'Programado para hoy')}</span>
    <strong>{q.count===null?tr('Unavailable','No disponible'):q.count}</strong>
   </Link>)}</div>
   {alertQueues.some(x=>x.count===null)&&<p role="alert">{tr('Some queues are temporarily unavailable; unknown values are not counted as zero.','Algunas bandejas no están disponibles; los valores desconocidos no se cuentan como cero.')}</p>}
  </section>
  {block('tasks',tr('Tasks and deadlines','Tareas y plazos'),
   tr('Prioritized by overdue dates, blocked work and urgency.','Priorizado por vencimientos, bloqueos y urgencia.'),
   data.tasks,'/admin/workspaces/estates/staff/tasks',tr('Manage all tasks','Gestionar todas las tareas'))}
  {block('maintenance',tr('Maintenance follow-up','Seguimiento de mantenimiento'),
   tr('New issues, blocked progress and cases ready for administrator review.','Nuevas incidencias, bloqueos y expedientes listos para revisión.'),
   data.maintenance,queueHref('triage'),tr('Open maintenance queue','Abrir bandeja de mantenimiento'))}
  {block('time',tr('Hours awaiting review','Horas pendientes de revisión'),
   tr('Actual staff hours, including operational work areas.','Horas reales del personal, incluidas las áreas operativas.'),
   data.time,queueHref('visits'),tr('All pending hours','Todas las horas pendientes'))}
  {block('corrections',tr('Time corrections','Correcciones de horas'),
   tr('Review correction requests without overwriting the original time record.','Revisar solicitudes sin sobrescribir el registro de horas original.'),
   data.corrections,queueHref('corrections'),tr('All corrections','Todas las correcciones'))}
  <footer className={s.footer}>   <Link href="/admin/workspaces/estates/zorgbalans">{tr('Zorgbalans private invoices','Facturas privadas Zorgbalans')}</Link>
   <Link href="/admin/workspaces/estates/weekly">{tr("Approve and close staff week","Aprobar y cerrar semana")}</Link>
   <Link href="/admin/workspaces/estates/time-report">{tr('Time Reporting 2.0','Informe de horas 2.0')}</Link>
   <Link href="/admin/workspaces/estates/staff">{tr('Staff and maintenance register','Registro de personal y mantenimiento')}</Link>
   <p>{tr('Time is not payroll or invoicing. Maintenance notes are not supplier work orders or approval decisions.','Las horas no equivalen a nóminas ni facturación. Las notas de mantenimiento no son órdenes o aprobaciones de proveedores.')}</p>
  </footer>
 </main>;
}
