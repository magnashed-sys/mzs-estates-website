import Link from 'next/link';
import {cookies} from 'next/headers';
import {safeStaffLanguage,staffText} from '../../lib/property-operations/staff-copy';
import StaffLanguagePicker from './StaffLanguagePicker';
import {requirePropertyStaff} from '../../lib/security/property-staff';
import {loadRegisters,allRows,type Params} from '../../lib/property-operations/staff-data';
import StaffForms from './StaffForms';
import StaffTaskBoard from './StaffTaskBoard';
import {staffTaskEnvironment,type PropertyTask} from '../../lib/property-operations/property-tasks';
import WorkRegisters from './WorkRegisters';
import LegacyWeekHistory,{type LegacyWeekRow} from './LegacyWeekHistory';
import s from './staff.module.css';
export const dynamic='force-dynamic';
export default async function StaffPage({searchParams}:{searchParams:Promise<Params>}){
 const {db,properties,user}=await requirePropertyStaff();const params=await searchParams;
 const taskEnabled=staffTaskEnvironment();
 const language=safeStaffLanguage((await cookies()).get('mzs_staff_language')?.value);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [data,units,tasks,areas,legacyRows,weeklyClosures]=await Promise.all([loadRegisters(db,params),allRows<{id:string;property_id:string;address:string}>((a,b)=>db.from('mzs_ops_staff_unit_directory').select('id,property_id,address',{count:'exact'}).order('id').range(a,b)),taskEnabled?allRows<PropertyTask>((a,b)=>db.from('mzs_ops_current_property_tasks').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(a,b)):Promise.resolve([]),allRows<{id:string;name:string}>((a,b)=>db.from('mzs_ops_staff_work_area_directory').select('id,name',{count:'exact'}).order('id').range(a,b)),allRows<LegacyWeekRow>((a,b)=>db.from('mzs_ops_staff_legacy_history')
  .select('id,reporting_year,iso_week,period_from,period_until,original_location,category,description,source_reference,close_status',{count:'exact'})
  .order('reporting_year',{ascending:false}).order('iso_week',{ascending:false}).order('id').range(a,b)),allRows<{id:string;week_start:string;action:string;approved_minutes:number;visit_count:number}>((a,b)=>db.from('mzs_ops_current_week_closures').select('id,week_start,action,approved_minutes,visit_count',{count:'exact'}).eq('profile_id',user.id).order('week_start',{ascending:false}).range(a,b))]);
 const requestedTask=typeof params.task==='string'?params.task:'';
 const initialTaskId=tasks.some(t=>t.id===requestedTask)?requestedTask:'';
 const ticketIds=data.tickets.rows.map(ticket=>ticket.id);
 const followups=ticketIds.length?await allRows<{id:string;ticket_id:string;note_kind:string;note:string;created_at:string}>(
  (a,b)=>db.from('mzs_ops_staff_ticket_notes')
    .select('id,ticket_id,note_kind,note,created_at',{count:'exact'})
    .in('ticket_id',ticketIds).order('created_at',{ascending:false}).order('id').range(a,b)
 ):[];
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
 <p><Link href="/staff/follow-ups">{language==='nl'?'Mijn administratieve opvolgtaken →':language==='es'?'Mis tareas de seguimiento →':'My administrative follow-up tasks →'}</Link></p>
 {taskEnabled?<StaffTaskBoard tasks={tasks} tickets={data.tickets.rows} followups={followups} properties={properties} units={units} areas={areas} profileId={user.id} today={today} language={language}/>:<><h2>Werkbezoeken &amp; onderhoud</h2><p>Registreer je werkzaamheden en volg de beoordeling en opvolging. Alleen jouw toegewezen objecten zijn beschikbaar.</p></>}
 <section id="hours" className={s.staffHours}><div className={s.mobileHead}><h2>{taskEnabled?staffText(language,'workingTime'):'Werkbezoeken & onderhoud'}</h2><p>{taskEnabled?staffText(language,'recordActual'):'Registreer je werkzaamheden en volg de beoordeling en opvolging.'}</p></div><StaffForms properties={properties} units={units} areas={areas} tasks={tasks} today={today} showMaintenanceForm={!taskEnabled} language={language} initialTaskId={initialTaskId}/></section>
 {taskEnabled&&<section className={s.recentMaintenance} aria-labelledby="recent-maintenance-heading">
  <div className={s.recentMaintenanceHead}><h2 id="recent-maintenance-heading">{staffText(language,'recentReports')}</h2>
   <a href="#work-history">{staffText(language,'viewAllReports')}</a></div>
  {data.tickets.rows.length?<div className={s.recentMaintenanceList}>
   {data.tickets.rows.slice(0,3).map(ticket=><a key={ticket.id}
    href={'/staff?ticket='+encodeURIComponent(ticket.id)+'#ticket'} className={s.recentMaintenanceItem}>
    <span><strong>{ticket.title}</strong>
     <small>{properties.find(p=>p.id===ticket.property_id)?.name??staffText(language,'property')}</small></span>
    <span aria-hidden="true">›</span>
   </a>)}
  </div>:<p className={s.description}>{staffText(language,'noRecentReports')}</p>}
 </section>}
 {taskEnabled?<details id="work-history" open={!!data.ticket||!!data.visit} className={s.staffHistory}>
 <summary>{staffText(language,'history')}</summary>
 <WorkRegisters data={data} params={params} properties={properties} areas={areas} tasks={tasks} staffLanguage={language}/><LegacyWeekHistory rows={legacyRows} language={language}/>{weeklyClosures.length>0&&<section className={s.panel}><h3>{language==='nl'?'Afgesloten weken':language==='es'?'Semanas cerradas':'Closed weeks'}</h3><ul>{weeklyClosures.map(w=><li key={w.id}>{w.week_start} · {w.action==='closed'?(language==='nl'?'Afgesloten':language==='es'?'Cerrada':'Closed')+' · '+Math.floor(w.approved_minutes/60)+'u '+w.approved_minutes%60+'m':(language==='nl'?'Heropend voor correctie':language==='es'?'Reabierta para corregir':'Reopened for correction')}</li>)}</ul></section>}</details>:<><WorkRegisters data={data} params={params} properties={properties} tasks={tasks} staffLanguage={language}/><LegacyWeekHistory rows={legacyRows} language={language}/>{weeklyClosures.length>0&&<section className={s.panel}><h3>{language==='nl'?'Afgesloten weken':language==='es'?'Semanas cerradas':'Closed weeks'}</h3><ul>{weeklyClosures.map(w=><li key={w.id}>{w.week_start} · {w.action==='closed'?(language==='nl'?'Afgesloten':language==='es'?'Cerrada':'Closed')+' · '+Math.floor(w.approved_minutes/60)+'u '+w.approved_minutes%60+'m':(language==='nl'?'Heropend voor correctie':language==='es'?'Reabierta para corregir':'Reopened for correction')}</li>)}</ul></section>}</>}</main>;
}
