import {cookies} from 'next/headers';
import {safeStaffLanguage,staffText} from '../../lib/property-operations/staff-copy';
import StaffLanguagePicker from './StaffLanguagePicker';
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
 const language=safeStaffLanguage((await cookies()).get('mzs_staff_language')?.value);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [data,units,tasks]=await Promise.all([loadRegisters(db,params),allRows<{id:string;property_id:string;address:string}>((a,b)=>db.from('mzs_ops_staff_unit_directory').select('id,property_id,address',{count:'exact'}).order('id').range(a,b)),taskEnabled?allRows<PropertyTask>((a,b)=>db.from('mzs_ops_current_property_tasks').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(a,b)):Promise.resolve([])]);
 return <main className={`${s.page} ${s.staffLanding}`}>
 <header className={s.managerBrandHeader}>
  <div className={s.managerLogo} aria-label="MZS Group">
   <span className={s.managerMonogram}>MZS</span>
   <span className={s.managerGroupLabel}>GROUP</span>
  </div>
  <span className={s.managerBrandDivider} aria-hidden="true"/>
  <h1 className={s.managerBrandTitle}>Property Manager</h1>
  <StaffLanguagePicker initial={language}/>
 </header>
 {taskEnabled?<StaffTaskBoard tasks={tasks} properties={properties} units={units} profileId={user.id} today={today} language={language}/>:<><h2>Werkbezoeken &amp; onderhoud</h2><p>Registreer je werkzaamheden en volg de beoordeling en opvolging. Alleen jouw toegewezen objecten zijn beschikbaar.</p></>}
 <section id="hours" className={s.staffHours}><div className={s.mobileHead}><h2>{taskEnabled?staffText(language,'workingTime'):'Werkbezoeken & onderhoud'}</h2><p>{taskEnabled?staffText(language,'recordActual'):'Registreer je werkzaamheden en volg de beoordeling en opvolging.'}</p></div><StaffForms properties={properties} units={units} tasks={tasks} today={today} showMaintenanceForm={!taskEnabled} language={language}/></section>
 {taskEnabled?<details className={s.staffHistory}><summary>{staffText(language,'history')}</summary><WorkRegisters data={data} params={params} properties={properties} tasks={tasks}/></details>:<WorkRegisters data={data} params={params} properties={properties} tasks={tasks}/>}</main>;
}
