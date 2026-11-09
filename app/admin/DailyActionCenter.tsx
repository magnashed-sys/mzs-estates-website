import Link from 'next/link';
import {getAdminI18n} from '../../lib/admin/i18n-server';
import {operationsDay} from '../../lib/property-operations/action-queues';
import {loadActionCenter} from '../../lib/admin/action-center-data';
import {actionCategories,actionFilters,actionHref,actionRoot,selectActions,type ActionSnapshot,type ActionFilters} from '../../lib/admin/action-center';
import {completenessLabels} from '../../lib/accountancy/completeness';
import s from './group-actions.module.css';

const labels:Record<string,[string,string]>={
 invoices:['Invoices','Facturas'],purchases:['Purchase reviews','Revisión de compras'],crm:['CRM follow-ups','Seguimientos CRM'],
 operations:['Staff & maintenance','Personal y mantenimiento'],requests:['Requests','Solicitudes'],system:['Notifications','Notificaciones'],
 overdue:['Overdue','Vencido'],today:['Due today','Para hoy'],review:['To review','Por revisar'],upcoming:['Upcoming','Próximo'],
 owner_stay:['Owner stay approval','Aprobar estancia de propietario'],booking_request:['Booking request','Solicitud de reserva'],
 capital_request:['Capital enquiry','Solicitud de capital'],failed_email:['Failed email deliveries','Correos no entregados'],
 operations_overdue:['Overdue maintenance','Mantenimiento vencido'],operations_today:['Maintenance scheduled today','Mantenimiento para hoy'],
 operations_triage:['Review maintenance reports','Revisar avisos de mantenimiento'],operations_planning:['Complete maintenance planning','Completar planificación'],
 operations_closure:['Review resolved maintenance','Revisar mantenimiento resuelto'],operations_corrections:['Review time corrections','Revisar correcciones de horas'],
 operations_visits:['Review time entries','Revisar horas registradas'],operations_budgets:['Review work budgets','Revisar presupuestos'],
 payment_unknown:['Payment balance unknown','Saldo de pago desconocido'],recorded_balance:['Current recorded balance','Saldo registrado actual'],
 imported_balance:['Includes an imported balance snapshot','Incluye saldo histórico importado']
};

export function ActionCenterView({snapshot,filters,language,locale,compact=false}:{snapshot:ActionSnapshot;filters:ActionFilters;language:string;locale:string;compact?:boolean}){
 const l=(en:string,es:string)=>language==='es'?es:en;
 const label=(key:string)=>labels[key]?.[language==='es'?1:0]??completenessLabels[key]?.[language==='es'?1:0]??key;
 const selected=selectActions(snapshot,filters,locale);
 const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(value/100);
 const currentYear=snapshot.today.slice(0,4);
 const base:ActionFilters={category:'all',priority:'attention',q:'',page:1};
 const unavailable=[...new Set(snapshot.failures.map(f=>f.category==='month'?l('Monthly review','Revisión mensual'):label(f.category)))];
 return <section id="daily-actions" className={`${s.panel} ${compact?s.compact:''}`} aria-labelledby={compact?'daily-summary-heading':'daily-actions-heading'}>
  <header className={s.header}>
   <div><p className={s.eyebrow}>{l('MZS GROUP / DAILY OVERVIEW','MZS GROUP / RESUMEN DIARIO')}</p>
    <h2 id={compact?'daily-summary-heading':'daily-actions-heading'}>{compact?l('Today’s priorities','Prioridades de hoy'):l('Central Action Center','Centro de acciones')}</h2>
   </div>
   {compact?<Link href={actionHref(base)} prefetch={false} className={s.primary}>{l('Open Action Center →','Abrir centro de acciones →')}</Link>:
    <form method="get" action={actionRoot+'#daily-actions'}>
     <input type="hidden" name="view" value="actions"/><input type="hidden" name="actionCategory" value={filters.category}/>
     <input type="hidden" name="actionPriority" value={filters.priority}/><input type="hidden" name="actionSearch" value={filters.q}/>
     <input type="hidden" name="actionPage" value={selected.page}/>
     <button type="submit" className={s.primary}>{l('Refresh overview','Actualizar resumen')}</button>
    </form>}
  </header>
  <p className={s.note}>{l('As of','A fecha de')} {date(snapshot.today)} · Europe/Madrid. {l('Counts cover overdue, today and undated review work. Future deadlines are available under Upcoming.','Los recuentos incluyen pendientes vencidos, para hoy y revisiones sin fecha. Los plazos futuros están en Próximo.')}</p>
  <nav className={s.summary} aria-label={l('Pending work by module','Pendientes por módulo')}>
   {selected.counts.map(c=><Link key={c.category} href={actionHref({...base,category:c.category})} prefetch={false} aria-current={!compact&&filters.category===c.category?'page':undefined}>
    <span>{label(c.category)}</span><strong>{c.count===null?'—':c.count}</strong>
    <small>{c.count===null?l('Incomplete source','Registro incompleto'):c.category==='purchases'?currentYear:l('Needs attention','Requiere atención')}</small>
   </Link>)}
  </nav>
  {unavailable.length>0&&<p className={s.warning} role="status">{l('Some lists could not be loaded completely; their counts are unknown:','No se han podido cargar algunas listas completas; sus recuentos son desconocidos:')} {unavailable.join(' · ')}.</p>}
  {!compact&&<>
   <form method="get" action={actionRoot+'#daily-actions'} className={s.filters}>
    <input type="hidden" name="view" value="actions"/>
    <label>{l('Module','Módulo')}<select name="actionCategory" defaultValue={filters.category}><option value="all">{l('All modules','Todos los módulos')}</option>{actionCategories.map(k=><option key={k} value={k}>{label(k)}</option>)}</select></label>
    <label>{l('Priority','Prioridad')}<select name="actionPriority" defaultValue={filters.priority}>
     <option value="attention">{l('Needs attention','Requiere atención')}</option><option value="all">{l('All open work','Todos los pendientes')}</option>
     {(['overdue','today','review','upcoming'] as const).map(k=><option key={k} value={k}>{label(k)}</option>)}
    </select></label>
    <label>{l('Search','Buscar')}<input type="search" name="actionSearch" defaultValue={filters.q} maxLength={100} placeholder={l('Invoice, contact, entity or task','Factura, contacto, entidad o tarea')}/></label>
    <button type="submit">{l('Apply','Aplicar')}</button><Link href={actionHref(base)} prefetch={false}>{l('Reset','Restablecer')}</Link>
   </form>
   <div className={s.listHeading}><h3>{l('Worklist','Lista de trabajo')}</h3><span>{selected.total} {l('matching records / worklists','registros / listas coincidentes')} · {selected.page}/{selected.pages}</span></div>
   {!selected.rows.length&&<p className={s.empty}>{unavailable.length?l('No matching items in the available sources. The unavailable lists still need checking.','Sin coincidencias en los registros disponibles. Quedan listas no disponibles por comprobar.'):l('No open items match these filters.','No hay pendientes que coincidan con estos filtros.')}</p>}
   <div className={s.list}>{selected.rows.map(item=><article key={item.id} className={s.item}>
    <div className={s.itemBody}><div className={s.meta}><span className={s[item.priority]}>{label(item.priority)}</span><span>{label(item.category)}</span>{item.entity&&<span>{item.entity}</span>}</div>
     <h4>{item.kind==='queue'?item.count+' · ':''}{item.category==='operations'||item.category==='requests'||item.category==='system'?label(item.title):item.title}</h4>
     {item.detail&&<p>{item.detail}</p>}
     {item.issues?.length? <p className={s.detail}>{item.issues.map(label).join(' · ')}</p>:null}
     {item.dueOn?<p className={s.deadline}>{l('Due','Vencimiento')}: <time dateTime={item.dueOn}>{date(item.dueOn)}</time></p>:item.kind==='record'?<p className={s.detail}>{l('No recorded deadline','Sin plazo registrado')}</p>:null}
    </div>
    <div className={s.itemAction}>{item.amountCents!==undefined&&<strong className={s.amount}>{money(item.amountCents)}</strong>}<Link href={item.href} prefetch={false}>{item.category==='system'?l('Notification settings →','Ajustes de notificaciones →'):item.kind==='queue'?l('Open worklist →','Abrir lista →'):l('Open dossier →','Abrir expediente →')}</Link></div>
   </article>)}</div>
   {selected.pages>1&&<nav className={s.pagination} aria-label={l('Action pages','Páginas de acciones')}>
    {selected.page>1&&<Link href={actionHref(filters,selected.page-1)} prefetch={false}>{l('← Previous','← Anterior')}</Link>}
    <span>{selected.page}/{selected.pages}</span>{selected.page<selected.pages&&<Link href={actionHref(filters,selected.page+1)} prefetch={false}>{l('Next →','Siguiente →')}</Link>}
   </nav>}
   <p className={s.note}>{l('Invoices and CRM tasks cover all recorded periods. Purchase checks cover current administrations for','Las facturas y tareas CRM abarcan todos los períodos registrados. Las compras corresponden a administraciones actuales de')} {currentYear}. {l('Staff entries open grouped worklists; notification issues link to delivery settings. Missing payment information is never classified as an overdue debt.','Las entradas de personal abren listas agrupadas; las incidencias de notificaciones llevan a los ajustes de envío. Un pago desconocido no se clasifica como deuda vencida.')}</p>
   <section className={s.monthSection} aria-labelledby="monthly-action-heading">
    <div className={s.listHeading}><h3 id="monthly-action-heading">{l('Monthly review by entity','Revisión mensual por entidad')}</h3><span>{snapshot.today.slice(0,7)}</span></div>
    <p className={s.note}>{l('These source checks can overlap the worklist above and are not additional tasks or a completed month close.','Estos controles pueden coincidir con la lista anterior; no son tareas adicionales ni un cierre contable realizado.')}</p>
    {!snapshot.months.length&&<p>{snapshot.failures.some(f=>f.category==='month')?l('Annual administrations could not be verified.','No se pudieron verificar las administraciones anuales.'):l('No current administration is registered for this year.','No hay administración actual registrada para este ejercicio.')} <Link href="/admin/workspaces/accountancy/administrations" prefetch={false}>{l('Open administrations →','Abrir administraciones →')}</Link></p>}
    <div className={s.months}>{snapshot.months.map(m=><article key={m.id} className={s.month}>
     <h4>{m.entity}</h4>{m.report?<dl>
      <div><dt>{l('Unpaid / unknown invoices','Facturas pendientes / desconocidas')}</dt><dd>{m.report.invoices.unpaidCount} / {m.report.invoices.unknownBalances}</dd></div>
      <div><dt>{l('Missing purchase PDFs','PDF de compras pendientes')}</dt><dd>{m.report.purchases.missingOriginals}</dd></div>
      <div><dt>{l('Purchase reviews pending','Compras por revisar')}</dt><dd>{m.report.purchases.pendingReview}</dd></div>
      <div><dt>{l('Bank entries unallocated','Movimientos bancarios sin asignar')}</dt><dd>{m.report.bank.unallocatedTransactions??l('Unknown','Desconocido')}</dd></div>
     </dl>:<p role="status">{l('Source figures unavailable','Cifras no disponibles')}</p>}
     <Link href={m.href} prefetch={false}>{l('Review month →','Revisar mes →')}</Link>
    </article>)}</div>
   </section>
  </>}
 </section>;
}

export default async function GroupActionCenter({db,query={},compact=false}:{db:Parameters<typeof loadActionCenter>[0];query?:Record<string,string|string[]|undefined>;compact?:boolean}){
 const {language,locale}=await getAdminI18n();
 let filters:ActionFilters;
 try{filters=actionFilters(compact?{}:query);}catch{return <p role="alert">{language==='es'?'Filtros no válidos.':'Invalid action filters.'} <Link href={actionRoot+'?view=actions'} prefetch={false}>{language==='es'?'Restablecer':'Reset'}</Link></p>;}
 const snapshot=await loadActionCenter(db,operationsDay(),!compact);
 return <ActionCenterView snapshot={snapshot} filters={filters} language={language} locale={locale} compact={compact}/>;
}
