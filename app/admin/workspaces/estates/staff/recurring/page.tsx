import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import {staffTaskEnvironment} from '../../../../../../lib/property-operations/property-tasks';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import type {RecurringPlan} from '../../../../../../lib/property-operations/recurring-tasks';
import PlanForm,{GenerateButton,type Choices} from './PlanForm';
import base from '../../../../../staff/staff.module.css';
import s from './recurring.module.css';
export const dynamic='force-dynamic';
export default async function RecurringTasks(){
 if(!staffTaskEnvironment())notFound();const {db}=await requireEstateAdmin();const {language}=await getAdminI18n();const es=language==='es',tr=(en:string,spanish:string)=>es?spanish:en;
 const read=<T,>(table:string,columns:string,order='id')=>allRows<T>((a,b)=>db.from(table).select(columns,{count:'exact'}).order(order).range(a,b) as unknown as PromiseLike<{data:T[]|null;error:unknown;count:number|null}>);
 const [plans,properties,units,members,scopes,areas,areaEvents,recent]=await Promise.all([
 read<RecurringPlan>('mzs_ops_recurring_plans','*'),read<Choices['properties'][number]>('mzs_estate_properties','id,name'),read<Choices['units'][number]>('mzs_estate_units','id,property_id,address'),
 allRows<Choices['members'][number]>((a,b)=>db.from('profiles').select('id,full_name,is_active',{count:'exact'}).in('role',['client','partner']).order('id').range(a,b)),
 allRows<Choices['scopes'][number]>((a,b)=>db.from('mzs_ops_current_staff_scopes').select('profile_id,property_id',{count:'exact'}).eq('action','grant').order('profile_id').order('property_id').range(a,b)),
 read<Choices['areas'][number]>('mzs_ops_staff_work_areas','id,name'),read<{profile_id:string;area_id:string;action:string;sequence_no:number}>('mzs_ops_staff_area_scopes','profile_id,area_id,action,sequence_no','sequence_no'),
 db.from('mzs_ops_recurring_occurrences').select('plan_id,due_on,task_id,generation_mode,created_at').order('created_at',{ascending:false}).order('task_id').limit(50)
 ]);
 if(recent.error)throw Error('Recurring task history unavailable');
 const latest=new Map<string,typeof areaEvents[number]>();for(const event of areaEvents)latest.set(event.profile_id+':'+event.area_id,event);
 const choices:Choices={properties,units,members,scopes,areas,areaScopes:[...latest.values()].filter(e=>e.action==='grant')};
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const state=(p:RecurringPlan)=>!p.is_active?tr('Paused','Pausado'):p.next_on>'2099-12-31'||p.end_on&&p.next_on>p.end_on?tr('Finished','Finalizado'):p.last_error?tr('Needs attention','Requiere atención'):tr('Active','Activo');
 return <main className={base.adminPage}><Link href='/admin/workspaces/estates/staff/tasks'>← {tr('Tasks & maintenance','Tareas y mantenimiento')}</Link><header className={s.header}><div><p>MZS GROUP · PROPERTY OPERATIONS</p><h1>{tr('Recurring work','Trabajos recurrentes')}</h1></div><GenerateButton es={es}/></header>
 <p className={s.muted}>{tr('Plan cleaning, maintenance and inspections. The hourly scheduler creates ordinary tasks for the assigned employee, with no automatic time entries or invoices.','Planifique limpieza, mantenimiento e inspecciones. El programador horario crea tareas para el empleado asignado, sin registrar horas ni facturar automáticamente.')}</p>
 <details className={s.card}><summary>{tr('Create recurring plan','Crear plan recurrente')}</summary><PlanForm key='new' id={randomUUID()} choices={choices} today={today} es={es}/></details>
 <h2>{tr('Schedules','Programaciones')} ({plans.length})</h2>{!plans.length&&<p>{tr('No schedules yet. Create a plan to start recurring work.','Todavía no hay programaciones. Cree un plan para empezar.')}</p>}
 {plans.map(p=><article key={p.id} className={s.card}><div className={s.header}><h2>{p.title}</h2><span className={s.tag}>{state(p)}</span></div><p>{properties.find(x=>x.id===p.property_id)?.name||areas.find(x=>x.id===p.work_area_id)?.name} · {members.find(x=>x.id===p.assigned_profile_id)?.full_name||tr('Employee unavailable','Empleado no disponible')}</p><p>{tr('Next due date','Próxima fecha límite')}: <strong>{p.next_on}</strong> · {tr('Create ahead','Antelación')}: {p.lead_days} {tr('days','días')}</p>{p.last_error&&<p role='alert' className={s.error}>{tr('Check the authorizing administrator, employee access, location and schedule. Then save to authorize again.','Revise el administrador autorizante, el acceso del empleado, la ubicación y las fechas. Después guarde para autorizar de nuevo.')}</p>}{p.skipped_on_resume>0&&<p>{tr('Past dates skipped when resuming','Fechas pasadas omitidas al reanudar')}: {p.skipped_on_resume}</p>}<details><summary>{tr('Edit or pause','Editar o pausar')}</summary><PlanForm key={p.revision} id={p.id} plan={p} choices={choices} today={today} es={es}/></details></article>)}
 <section className={s.card}><h2>{tr('Recently generated tasks · latest 50','Tareas generadas recientemente · últimas 50')}</h2><div className={s.scroll}><table><thead><tr>{[tr('Plan','Plan'),tr('Due date','Fecha límite'),tr('Generation','Generación'),tr('Task','Tarea')].map(x=><th key={x} scope='col'>{x}</th>)}</tr></thead><tbody>{(recent.data||[]).map(r=><tr key={r.task_id}><td>{plans.find(p=>p.id===r.plan_id)?.title}</td><td>{r.due_on}</td><td>{r.generation_mode==='scheduler'?tr('Automatic','Automática'):tr('Administrator','Administrador')}</td><td><Link href={'/admin/workspaces/estates/staff/tasks#task-'+r.task_id}>{tr('Open task register','Abrir tareas')}</Link></td></tr>)}</tbody></table></div>{!recent.data?.length&&<p>{tr('No tasks have been generated yet.','Todavía no se han generado tareas.')}</p>}</section>
 </main>;
}
