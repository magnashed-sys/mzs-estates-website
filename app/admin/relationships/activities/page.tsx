import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../lib/security/estate-properties';
import {readRegister} from '../../../../lib/estates/read-register';
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {crmActivitySummary,crmUuid,type CrmActivity} from '../../../../lib/relationships/crm-activities';
import {CrmActivityCreate,CrmTaskUpdate} from './forms';
import s from './activities.module.css';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
type Relationship={id:string;name:string;kind:string;email:string;roles:string[]};

export default async function CrmActivities({searchParams}:{searchParams:Promise<Params>}){
 const {db}=await requireEstateAdmin();
 const {language,locale:locale}=await getAdminI18n();
 const l=(en:string,es:string)=>language==='es'?es:en;
 const q=await searchParams;
 const relationshipId=typeof q.relationship==='string'?q.relationship:'';
 const scope=typeof q.scope==='string'?q.scope:'active';
 const query=typeof q.q==='string'?q.q.trim():'';
 const focus=typeof q.activity==='string'?q.activity:'';
 if(q.activity!==undefined&&(!focus||!crmUuid(focus)))notFound();
 if((relationshipId&&!crmUuid(relationshipId))||!['active','overdue','completed','all'].includes(scope)||query.length>100)notFound();

 const [contacts,activities]=await Promise.all([
  readRegister(db,'mzs_lease_relationships') as Promise<Relationship[]>,
  readRegister(db,'mzs_crm_activities') as Promise<CrmActivity[]>
 ]);
 const names=new Map(contacts.map(x=>[x.id,x.name]));
 if(relationshipId&&!names.has(relationshipId))notFound();
 const order=new Intl.Collator(locale,{sensitivity:'base',numeric:true});
 const options=[...contacts].sort((a,b)=>order.compare(a.name,b.name)||a.id.localeCompare(b.id));
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stats=crmActivitySummary(activities.filter(a=>!relationshipId||a.relationship_id===relationshipId),today);
 const rows=activities.filter(a=>
  (!relationshipId||a.relationship_id===relationshipId)&&
  (scope==='all'||scope==='active'&&a.kind==='task'&&a.status==='open'||
   scope==='overdue'&&a.kind==='task'&&a.status==='open'&&!!a.due_on&&a.due_on<today||
   scope==='completed'&&a.status==='done')&&
  (!query||[a.title,a.detail,names.get(a.relationship_id)??'',a.kind].join(' ').toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)))
 );
 const pageSize=25;
 const rawPage=typeof q.page==='string'&&/^[1-9]\d{0,4}$/.test(q.page)?Number(q.page):1;
 const focusIndex=focus?rows.findIndex(a=>a.id===focus):-1;
 const pageCount=Math.max(1,Math.ceil(rows.length/pageSize)),page=focusIndex>=0?Math.floor(focusIndex/pageSize)+1:Math.min(rawPage,pageCount);
 const href=(n:number)=>{
  const p=new URLSearchParams();
  if(relationshipId)p.set('relationship',relationshipId);
  if(scope!=='active')p.set('scope',scope);
  if(query)p.set('q',query);
  if(n>1)p.set('page',String(n));
  return '/admin/relationships/activities'+(p.size?'?'+p:'');
 };
 return <main className={s.page}>
  <Link href="/admin/relationships" className={s.back}>{l('← Relationships','← Relaciones')}</Link>
  <header className={s.heading}><div>
   <p className={s.kicker}>{l('MZS GROUP / RELATIONSHIPS','MZS GROUP / RELACIONES')}</p>
   <h1>{l('CRM activities & follow-ups','Actividades y seguimiento CRM')}</h1>
   <p>{l('Record contact moments and follow up agreed actions. Notes do not send email, change client access or alter financial records.','Registre contactos y dé seguimiento a las tareas acordadas. Las notas no envían correos ni modifican accesos o registros financieros.')}</p>
  </div></header>
  <section className={s.metrics} aria-label={l('CRM activity summary','Resumen de actividades CRM')}>
   <div><small>{l('Open follow-ups','Tareas abiertas')}</small><strong>{stats.open}</strong></div>
   <div><small>{l('Overdue follow-ups','Tareas vencidas')}</small><strong>{stats.overdue}</strong></div>
   <div><small>{l('Completed follow-ups','Tareas completadas')}</small><strong>{stats.completed}</strong></div>
   <div><small>{l('Recorded contact moments','Contactos registrados')}</small><strong>{stats.contacts}</strong></div>
  </section>
  <CrmActivityCreate relationships={options.map(c=>({id:c.id,name:c.name,kind:c.kind}))} initialRelationship={relationshipId} language={language}/>
  <section className={s.panel} aria-label={l('CRM worklist','Lista de trabajo CRM')}>
   <h2>{l('Worklist and history','Tareas e historial')}</h2>
   <form method="get" className={s.filters}>
    <label>{l('Relationship','Relación')}<select name="relationship" defaultValue={relationshipId}>
     <option value="">{l('All relationships','Todas las relaciones')}</option>
     {options.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <label>{l('Status','Estado')}<select name="scope" defaultValue={scope}>
     <option value="active">{l('Open tasks','Tareas abiertas')}</option>
     <option value="overdue">{l('Overdue','Vencidas')}</option>
     <option value="completed">{l('Completed and contact history','Completadas e historial')}</option>
     <option value="all">{l('All activities','Todas las actividades')}</option>
    </select></label>
    <label>{l('Search','Buscar')}<input type="search" name="q" maxLength={100} defaultValue={query} placeholder={l('Contact, subject or note','Contacto, asunto o nota')}/></label>
    <button type="submit">{l('Apply filters','Aplicar filtros')}</button>
    <Link href="/admin/relationships/activities">{l('Reset','Restablecer')}</Link>
   </form>
   <p className={s.note}>{l('Showing','Mostrando')} {rows.length} {l('matching activities. Contact history is append-only; task updates are audited.','actividades coincidentes. El historial es inmutable y los cambios de tareas se auditan.')}</p>
   {!rows.length&&<p>{l('No activities match this view. Choose All activities to review contact history.','No hay actividades en esta vista. Seleccione Todas las actividades para revisar el historial.')}</p>}
   <div className={s.list}>
    {rows.slice((page-1)*pageSize,page*pageSize).map(item=><article id={'activity-'+item.id} key={item.id} className={s.activity}>
     <div className={s.activityHeading}>
      <div><small>{l(item.kind==='task'?'Follow-up':item.kind==='note'?'Note':item.kind==='call'?'Call':item.kind==='email'?'Email':'Meeting',item.kind==='task'?'Seguimiento':item.kind==='note'?'Nota':item.kind==='call'?'Llamada':item.kind==='email'?'Correo':'Reunión')}</small>
       <h3>{item.title}</h3><Link href={'/admin/relationships/overview?relationship='+item.relationship_id}>{names.get(item.relationship_id)??l('Unknown relationship','Relación desconocida')} →</Link></div>
      <span className={item.status==='open'?s.open:s.done}>{item.status==='open'?l('Open','Abierta'):l('Completed','Completada')}</span>
     </div>
     {item.detail&&<p className={s.detail}>{item.detail}</p>}
     <p className={s.meta}>{l('Recorded','Registrado')}: {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'Europe/Madrid'}).format(new Date(item.created_at))}
      {item.kind==='task'&&' · '+l('Due','Vence')+': '+(item.due_on??'—')}</p>
     {item.kind==='task'&&<CrmTaskUpdate task={item} language={language}/>}
    </article>)}
   </div>
   {pageCount>1&&<nav className={s.pagination} aria-label={l('Activity pages','Páginas de actividades')}>
    {page>1&&<Link href={href(page-1)}>{l('← Previous','← Anterior')}</Link>}
    <span>{l('Page','Página')} {page}/{pageCount}</span>
    {page<pageCount&&<Link href={href(page+1)}>{l('Next →','Siguiente →')}</Link>}
   </nav>}
  </section>
  <p className={s.note}>{l('Activities are internal working notes, not verified communication delivery logs or legally binding approvals. Changing an activity never changes an invoice, contact login, property or loan.','Las actividades son notas internas, no justificantes de envío ni aprobaciones vinculantes. Cambiarlas no modifica facturas, accesos, inmuebles ni préstamos.')}</p>
 </main>;
}
