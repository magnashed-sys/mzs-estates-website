import Link from 'next/link';
import {requirePropertyStaff} from '../../lib/security/property-staff';
import {loadRegisters,allRows,type Params} from '../../lib/property-operations/staff-data';
import StaffForms from './StaffForms';
import StaffTaskBoard from './StaffTaskBoard';
import {staffTaskEnvironment,type PropertyTask} from '../../lib/property-operations/property-tasks';
import WorkRegisters from './WorkRegisters';
import s from './staff.module.css';
export const dynamic='force-dynamic';
export default async function StaffPage({searchParams}:{searchParams:Promise<Params>}){
 const {db,properties,user}=await requirePropertyStaff();const params=await searchParams;
 const taskEnabled=staffTaskEnvironment();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [data,units,tasks]=await Promise.all([loadRegisters(db,params),allRows<{id:string;property_id:string;address:string}>((a,b)=>db.from('mzs_ops_staff_unit_directory').select('id,property_id,address',{count:'exact'}).order('id').range(a,b)),taskEnabled?allRows<PropertyTask>((a,b)=>db.from('mzs_ops_current_property_tasks').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(a,b)):Promise.resolve([])]);
 return <main className={s.page}><Link href="/private">← Mijn omgeving</Link>
 {taskEnabled?<StaffTaskBoard tasks={tasks} properties={properties} units={units} profileId={user.id} today={today}/>:<><h1>Werkbezoeken &amp; onderhoud</h1><p>Registreer je werkzaamheden en volg de beoordeling en opvolging. Alleen jouw toegewezen objecten zijn beschikbaar.</p></>}
 <section id="hours" className={s.staffHours}><div className={s.mobileHead}><p className={s.kicker}>WORK JOURNAL</p><h2>{taskEnabled?'Log actual working time':'Werkbezoeken & onderhoud'}</h2><p>{taskEnabled?'Record actual time against a property, unit and, if relevant, a task.':'Registreer je werkzaamheden en volg de beoordeling en opvolging.'}</p></div><StaffForms properties={properties} units={units} tasks={tasks} today={today}/></section>
 {taskEnabled?<details className={s.staffHistory}><summary>Work visits and maintenance history</summary><WorkRegisters data={data} params={params} properties={properties} tasks={tasks}/></details>:<WorkRegisters data={data} params={params} properties={properties} tasks={tasks}/>}</main>;
}
