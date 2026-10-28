import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {timeFilters,timeReportHref,timeDossierHref,loadTimeReport,workDuration,timeStates,type TimeFilters,type TimeTotals} from '../../../../../lib/property-operations/time-report';
import type {Params} from '../../../../../lib/property-operations/staff-data';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';

export default async function StaffTimeReport({searchParams}:{searchParams:Promise<Params>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 let filters:TimeFilters;try{filters=timeFilters(params);}catch(error){return <main><h1>Invalid report selection</h1><p>{error instanceof Error?error.message:"Check the filters."}</p><Link href="/admin/workspaces/estates/time-report">Clear filters</Link></main>;}
 const report=await loadTimeReport(db,filters),pages=Math.max(1,Math.ceil(report.visits.length/25));
 if(filters.page>pages)redirect(timeReportHref(filters,pages));
 const people=new Map(report.people.map(p=>[p.id,p.name])),properties=new Map(report.properties.map(p=>[p.id,p.name]));
 const states=Object.keys(timeStates) as (keyof typeof timeStates)[];
 const groups=(title:string,rows:[string,TimeTotals][],names?:Map<string,string>)=><section className={s.panel}><h2>{title}</h2>{!rows.length?<p>No work visits match this selection.</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{title==="By staff member"?"Staff member":title==="By property"?"Property":"Month"}</th><th>Visits</th><th>Current duration</th>{states.map(key=><th key={key}>{timeStates[key]}</th>)}</tr></thead><tbody>{rows.map(([id,total])=><tr key={id}><td>{names?.get(id)??id}</td><td>{total.count}</td><td>{workDuration(total.minutes)}</td>{states.map(key=><td key={key}>{workDuration(total[key].minutes)}</td>)}</tr>)}</tbody></table></div>}</section>;
 return <main className={s.adminPage}><Link href="/admin/workspaces/staff">← Staff</Link><h1>Time reporting</h1><p><Link href="/admin/workspaces/estates/history">Historical weekly statements and earlier invoices →</Link></p><p>Time worked by period, staff member and property. All durations use hours:minutes; 1:30 means one hour and thirty minutes.</p>
  <form method="get" className={s.filter}><label>From<input type="date" name="from" required defaultValue={filters.from}/></label><label>Through<input type="date" name="until" required defaultValue={filters.until}/></label><label>Property<select name="property" defaultValue={filters.property}><option value="">All properties</option>{report.properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Staff member<select name="profile" defaultValue={filters.profile}><option value="">All accounts</option>{report.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button>Update report</button></form>
  <section className={s.panel}><h2>{report.total.count} work visits · {workDuration(report.total.minutes)} current duration</h2><p>Period by work date: {filters.from} through {filters.until}. Snapshot: {new Intl.DateTimeFormat("en-GB",{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'medium'}).format(new Date(report.generatedAt))} (Europe/Madrid).</p>
   <ul>{states.map(key=><li key={key}><strong>{timeStates[key]}: {workDuration(report.total[key].minutes)}</strong> · {report.total[key].count} work visits</li>)}</ul>
   <p>Approved corrections are included in current durations; original minutes are retained. For an open correction request, the last recorded duration is shown separately and does not count as finally approved. The proposed minutes appear in the dossier.</p>
   <p>This overview does not include rounded recharge minutes, payroll, rates or invoices.</p><a href={timeReportHref(filters,1,true)}>Download the full selection as CSV →</a><p>The download retrieves a fresh snapshot; intervening reviews may differ from this screen. The CSV includes its timestamp.</p>
  </section>
  {groups("By staff member",report.byPerson,people)}{groups("By property",report.byProperty,properties)}{groups("By month",report.byMonth)}
  <section className={s.panel} id="visits"><h2>Work visits</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Work date / property</th><th>Staff member</th><th>Original</th><th>Current</th><th>Status</th><th>Dossier</th></tr></thead><tbody>{report.visits.slice((filters.page-1)*25,filters.page*25).map(v=><tr key={v.id}><td>{v.worked_on}<br/>{v.property_name}</td><td>{v.person_name}</td><td>{workDuration(v.actual_minutes)}</td><td>{workDuration(v.effective_minutes)}</td><td>{timeStates[v.state]}</td><td><Link href={timeDossierHref(filters,v.id)} prefetch={false}>Open work visit →</Link></td></tr>)}</tbody></table></div>{!report.visits.length&&<p>No work visits match this selection.</p>}
   <nav className={s.pagination} aria-label="Work visits in report">{filters.page>1&&<Link href={timeReportHref(filters,filters.page-1)+'#visits'} prefetch={false}>← Previous</Link>}<span>Page {filters.page} of {pages} · totals above cover all {report.visits.length} visits</span>{filters.page<pages&&<Link href={timeReportHref(filters,filters.page+1)+'#visits'} prefetch={false}>Next →</Link>}</nav>
  </section>
 </main>;
}
