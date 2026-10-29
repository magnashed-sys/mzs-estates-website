
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {timeFilters,timeReportHref,timeDossierHref,loadTimeReport,workDuration,timeStates,type TimeFilters,type TimeTotals} from '../../../../../lib/property-operations/time-report';
import type {Params} from '../../../../../lib/property-operations/staff-data';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';

export default async function StaffTimeReport({searchParams}:{searchParams:Promise<Params>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 let filters:TimeFilters;try{filters=timeFilters(params);}catch(error){return <main><h1>{adminT("Invalid report selection")}</h1><p>{error instanceof Error?error.message:adminT("Check the filters.")}</p><Link href="/admin/workspaces/estates/time-report">{adminT("Clear filters")}</Link></main>;}
 const report=await loadTimeReport(db,filters),pages=Math.max(1,Math.ceil(report.visits.length/25));
 if(filters.page>pages)redirect(timeReportHref(filters,pages));
 const people=new Map(report.people.map(p=>[p.id,p.name])),properties=new Map(report.properties.map(p=>[p.id,p.name]));
 const states=Object.keys(timeStates) as (keyof typeof timeStates)[];
 const groups=(title:string,rows:[string,TimeTotals][],names?:Map<string,string>)=><section className={s.panel}><h2>{title}</h2>{!rows.length?<p>{adminT("No work visits match this selection.")}</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{title==="By staff member"?adminT("Staff member"):title==="By property"?adminT("Property"):adminT("Month")}</th><th>{adminT("Visits")}</th><th>{adminT("Current duration")}</th>{states.map(key=><th key={key}>{timeStates[key]}</th>)}</tr></thead><tbody>{rows.map(([id,total])=><tr key={id}><td>{names?.get(id)??id}</td><td>{total.count}</td><td>{workDuration(total.minutes)}</td>{states.map(key=><td key={key}>{workDuration(total[key].minutes)}</td>)}</tr>)}</tbody></table></div>}</section>;
 return <main className={s.adminPage}><Link href="/admin/workspaces/staff">{adminT("← Staff")}</Link><h1>{adminT("Time reporting")}</h1><p><Link href="/admin/workspaces/estates/history">{adminT("Historical weekly statements and earlier invoices →")}</Link></p><p>{adminT("Time worked by period, staff member and property. All durations use hours:minutes; 1:30 means one hour and thirty minutes.")}</p>
  <form method="get" className={s.filter}><label>{adminT("From")}<input type="date" name="from" required defaultValue={filters.from}/></label><label>{adminT("Through")}<input type="date" name="until" required defaultValue={filters.until}/></label><label>{adminT("Property")}<select name="property" defaultValue={filters.property}><option value="">{adminT("All properties")}</option>{report.properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>{adminT("Staff member")}<select name="profile" defaultValue={filters.profile}><option value="">{adminT("All accounts")}</option>{report.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button>{adminT("Update report")}</button></form>
  <section className={s.panel}><h2>{report.total.count}  {adminT("work visits ·")} {workDuration(report.total.minutes)}  {adminT("current duration")}</h2><p>{adminT("Period by work date:")} {filters.from}  {adminT("through")} {filters.until}{adminT(". Snapshot:")} {new Intl.DateTimeFormat(adminLocale,{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'medium'}).format(new Date(report.generatedAt))}  {adminT("(Europe/Madrid).")}</p>
   <ul>{states.map(key=><li key={key}><strong>{timeStates[key]}: {workDuration(report.total[key].minutes)}</strong> · {report.total[key].count}  {adminT("work visits")}</li>)}</ul>
   <p>{adminT("Approved corrections are included in current durations; original minutes are retained. For an open correction request, the last recorded duration is shown separately and does not count as finally approved. The proposed minutes appear in the dossier.")}</p>
   <p>{adminT("This overview does not include rounded recharge minutes, payroll, rates or invoices.")}</p><a href={timeReportHref(filters,1,true)}>{adminT("Download the full selection as CSV →")}</a><p>{adminT("The download retrieves a fresh snapshot; intervening reviews may differ from this screen. The CSV includes its timestamp.")}</p>
  </section>
  {groups("By staff member",report.byPerson,people)}{groups("By property",report.byProperty,properties)}{groups("By month",report.byMonth)}
  <section className={s.panel} id="visits"><h2>{adminT("Work visits")}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Work date / property")}</th><th>{adminT("Staff member")}</th><th>{adminT("Original")}</th><th>{adminT("Current")}</th><th>{adminT("Status")}</th><th>{adminT("Dossier")}</th></tr></thead><tbody>{report.visits.slice((filters.page-1)*25,filters.page*25).map(v=><tr key={v.id}><td>{v.worked_on}<br/>{v.property_name}</td><td>{v.person_name}</td><td>{workDuration(v.actual_minutes)}</td><td>{workDuration(v.effective_minutes)}</td><td>{timeStates[v.state]}</td><td><Link href={timeDossierHref(filters,v.id)} prefetch={false}>{adminT("Open work visit →")}</Link></td></tr>)}</tbody></table></div>{!report.visits.length&&<p>{adminT("No work visits match this selection.")}</p>}
   <nav className={s.pagination} aria-label={adminT("Work visits in report")}>{filters.page>1&&<Link href={timeReportHref(filters,filters.page-1)+'#visits'} prefetch={false}>{adminT("← Previous")}</Link>}<span>{adminT("Page")} {filters.page}  {adminT("of")} {pages}  {adminT("· totals above cover all")} {report.visits.length}  {adminT("visits")}</span>{filters.page<pages&&<Link href={timeReportHref(filters,filters.page+1)+'#visits'} prefetch={false}>{adminT("Next →")}</Link>}</nav>
  </section>
 </main>;
}
