import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import {staffTaskEnvironment,taskOverview,type PropertyTask} from '../../../../../../lib/property-operations/property-tasks';
import PropertyTaskAdmin from './PropertyTaskAdmin';
import s from '../../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
export default async function Tasks(){
 if(!staffTaskEnvironment())notFound();
 const {db}=await requireEstateAdmin(),{language}=await getAdminI18n();
 const [tasks,properties,units,members,scopes,visits]=await Promise.all([
  allRows<PropertyTask>((a,b)=>db.from('mzs_ops_current_property_tasks').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(a,b)),
  allRows<{id:string;name:string;address:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name,address',{count:'exact'}).order('name').order('id').range(a,b)),
  allRows<{id:string;property_id:string;address:string}>((a,b)=>db.from('mzs_estate_units').select('id,property_id,address',{count:'exact'}).order('property_id').order('id').range(a,b)),
  allRows<{id:string;full_name:string;is_active:boolean}>((a,b)=>db.from('profiles').select('id,full_name,is_active',{count:'exact'}).in('role',['client','partner']).order('full_name').order('id').range(a,b)),
  allRows<{profile_id:string;property_id:string}>((a,b)=>db.from('mzs_ops_current_staff_scopes').select('profile_id,property_id',{count:'exact'}).eq('action','grant').order('profile_id').order('property_id').range(a,b)),
  allRows<{task_id:string;effective_minutes:number}>((a,b)=>db.from('mzs_ops_current_visits').select('task_id,effective_minutes',{count:'exact'}).not('task_id','is',null).order('id').range(a,b))
 ]);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stats=taskOverview(tasks,today),tr=(en:string,es:string)=>language==='es'?es:en;
 const byTask=new Map<string,{task_id:string;minutes:number;visits:number}>();
 for(const visit of visits){const item=byTask.get(visit.task_id)??{task_id:visit.task_id,minutes:0,visits:0};item.minutes+=visit.effective_minutes;item.visits++;byTask.set(visit.task_id,item);}
 return <main className={s.page}><Link href="/admin/workspaces/estates/staff">← {tr('Staff and maintenance','Personal y mantenimiento')}</Link>
  <header className={s.mobileHead}><p className={s.kicker}>MZS GROUP · PROPERTY OPERATIONS</p>
   <h1>{tr('Property manager tasks','Tareas de gestión inmobiliaria')}</h1>
   <p>{tr('Create, plan, assign and follow up work. Each task is tied to a property, optionally a unit. Updates are audited.','Cree, planifique, asigne y supervise trabajos. Cada tarea se vincula a un inmueble y, opcionalmente, una unidad. Los cambios quedan auditados.')}</p>
  </header>
  <div className={s.mobileStats}>
   <div><small>{tr('Open','Abiertas')}</small><strong>{stats.open}</strong></div>
   <div><small>{tr('Due / unplanned','Pendientes hoy / sin plan')}</small><strong>{stats.today}</strong></div>
   <div><small>{tr('High priority','Alta prioridad')}</small><strong>{stats.urgent}</strong></div>
   <div><small>{tr('Completed','Completadas')}</small><strong>{stats.completed}</strong></div>
  </div>
  <p className={s.note}>{tr('Supplier costs and historical expense statements are not tasks or recorded worked hours. Tasks do not create work orders, invoices or cash movements.','Los costes históricos no se convierten en tareas ni horas trabajadas. Las tareas no generan órdenes, facturas ni movimientos de dinero.')}</p>
  <PropertyTaskAdmin language={language==='es'?'es':'en'} properties={properties} units={units} members={members} scopes={scopes} tasks={tasks} timeTotals={[...byTask.values()]}/>
 </main>;
}
