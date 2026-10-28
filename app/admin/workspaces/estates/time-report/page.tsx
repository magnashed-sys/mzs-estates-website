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
 let filters:TimeFilters;try{filters=timeFilters(params);}catch(error){return <main><h1>Ongeldige rapportselectie</h1><p>{error instanceof Error?error.message:'Controleer de filters.'}</p><Link href="/admin/workspaces/estates/time-report">Wis filters</Link></main>;}
 const report=await loadTimeReport(db,filters),pages=Math.max(1,Math.ceil(report.visits.length/25));
 if(filters.page>pages)redirect(timeReportHref(filters,pages));
 const people=new Map(report.people.map(p=>[p.id,p.name])),properties=new Map(report.properties.map(p=>[p.id,p.name]));
 const states=Object.keys(timeStates) as (keyof typeof timeStates)[];
 const groups=(title:string,rows:[string,TimeTotals][],names?:Map<string,string>)=><section className={s.panel}><h2>{title}</h2>{!rows.length?<p>Geen werkbezoeken in deze selectie.</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{title==='Per medewerker'?'Medewerker':title==='Per object'?'Object':'Maand'}</th><th>Bezoeken</th><th>Huidige tijd</th>{states.map(key=><th key={key}>{timeStates[key]}</th>)}</tr></thead><tbody>{rows.map(([id,total])=><tr key={id}><td>{names?.get(id)??id}</td><td>{total.count}</td><td>{workDuration(total.minutes)}</td>{states.map(key=><td key={key}>{workDuration(total[key].minutes)}</td>)}</tr>)}</tbody></table></div>}</section>;
 return <main className={s.adminPage}><Link href="/admin/workspaces/estates">← Vastgoedbeheer</Link><h1>Urenrapportage</h1><p>Gewerkte tijd per periode, medewerker en object. Alle tijden staan als uren:minuten; 1:30 is één uur en dertig minuten.</p>
  <form method="get" className={s.filter}><label>Van<input type="date" name="from" required defaultValue={filters.from}/></label><label>Tot en met<input type="date" name="until" required defaultValue={filters.until}/></label><label>Object<select name="property" defaultValue={filters.property}><option value="">Alle objecten</option>{report.properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Medewerker<select name="profile" defaultValue={filters.profile}><option value="">Alle accounts</option>{report.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button>Rapport bijwerken</button></form>
  <section className={s.panel}><h2>{report.total.count} werkbezoeken · {workDuration(report.total.minutes)} huidige tijd</h2><p>Periode op werkdatum: {filters.from} tot en met {filters.until}. Momentopname: {new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'medium'}).format(new Date(report.generatedAt))} (Europe/Madrid).</p>
   <ul>{states.map(key=><li key={key}><strong>{timeStates[key]}: {workDuration(report.total[key].minutes)}</strong> · {report.total[key].count} werkbezoeken</li>)}</ul>
   <p>Goedgekeurde correcties zijn verwerkt in de huidige tijd; de oorspronkelijke minuten blijven bewaard. Bij een open correctieverzoek staat de laatst vastgelegde tijd apart en telt die niet mee als definitief goedgekeurd. Het voorgestelde aantal minuten staat in het dossier.</p>
   <p>Dit overzicht bevat geen afgeronde doorbelastingsminuten, loonberekening, tarieven of facturen.</p><a href={timeReportHref(filters,1,true)}>Download de volledige selectie als CSV →</a><p>De download haalt een nieuwe momentopname op; tussentijdse beoordelingen kunnen daardoor afwijken van dit scherm. Het CSV-bestand vermeldt het tijdstip.</p>
  </section>
  {groups('Per medewerker',report.byPerson,people)}{groups('Per object',report.byProperty,properties)}{groups('Per maand',report.byMonth)}
  <section className={s.panel} id="visits"><h2>Werkbezoeken</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Werkdatum / object</th><th>Medewerker</th><th>Oorspronkelijk</th><th>Huidig</th><th>Status</th><th>Dossier</th></tr></thead><tbody>{report.visits.slice((filters.page-1)*25,filters.page*25).map(v=><tr key={v.id}><td>{v.worked_on}<br/>{v.property_name}</td><td>{v.person_name}</td><td>{workDuration(v.actual_minutes)}</td><td>{workDuration(v.effective_minutes)}</td><td>{timeStates[v.state]}</td><td><Link href={timeDossierHref(filters,v.id)} prefetch={false}>Open werkbezoek →</Link></td></tr>)}</tbody></table></div>{!report.visits.length&&<p>Geen werkbezoeken in deze selectie.</p>}
   <nav className={s.pagination} aria-label="Werkbezoeken in rapport">{filters.page>1&&<Link href={timeReportHref(filters,filters.page-1)+'#visits'} prefetch={false}>← Vorige</Link>}<span>Pagina {filters.page} van {pages} · totalen hierboven gelden voor alle {report.visits.length} bezoeken</span>{filters.page<pages&&<Link href={timeReportHref(filters,filters.page+1)+'#visits'} prefetch={false}>Volgende →</Link>}</nav>
  </section>
 </main>;
}
