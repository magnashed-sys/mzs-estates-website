import Link from 'next/link';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {allRows,type Params} from '../../../../../lib/property-operations/staff-data';
import {operationsDay} from '../../../../../lib/property-operations/action-queues';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import WeekControls,{type WeekRow} from './WeekControls';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
const valid=/^20\d{2}-\d{2}-\d{2}$/;
function monday(date:string){
 if(!valid.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z')))return null;
 const d=new Date(date+'T00:00:00Z');
 if(d.toISOString().slice(0,10)!==date)return null;
 d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
 return d.toISOString().slice(0,10);
}
const after=(date:string,days:number)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
type Event={id:string;week_start:string;action:'closed'|'reopened';visit_count:number;approved_minutes:number;note:string;created_at:string};
export default async function WeeklyStaff({searchParams}:{searchParams:Promise<Params>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const {language}=await getAdminI18n();
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const params=await searchParams,today=operationsDay();
 const week=monday(typeof params.week==='string'?params.week:today)??monday(today)!;
 const until=after(week,7),sunday=after(week,6);
 const people=await allRows<{id:string;full_name:string|null;email:string|null}>((a,b)=>db.from('profiles')
  .select('id,full_name,email',{count:'exact'}).in('role',['client','partner']).eq('is_active',true).order('id').range(a,b));
 const requested=typeof params.profile==='string'?params.profile:'';
 const selected=people.find(p=>p.id===requested)??people.find(p=>p.email?.toLowerCase()==='ledders2@hotmail.com')??people[0];
 if(!selected)return <main className={s.adminPage}><h1>{tr('Weekly time closeout','Cierre semanal de horas')}</h1><p>{tr('No active staff accounts.','No hay cuentas activas.')}</p></main>;
 const [visits,history,properties,areas]=await Promise.all([
  allRows<WeekRow>((a,b)=>db.from('mzs_ops_current_visits')
    .select('id,worked_on,actual_minutes,effective_minutes,description,work_area_id,property_id,unit_id,review_decision,correction_pending,correction_id,task_category',{count:'exact'})
    .eq('profile_id',selected.id).gte('worked_on',week).lt('worked_on',until).order('worked_on').order('id').range(a,b)),
  allRows<Event>((a,b)=>db.from('mzs_ops_week_events')
    .select('id,week_start,action,visit_count,approved_minutes,note,created_at',{count:'exact'})
    .eq('profile_id',selected.id).order('sequence_no',{ascending:false}).range(a,b)),
  allRows<{id:string;name:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
  allRows<{id:string;name:string}>((a,b)=>db.from('mzs_ops_staff_work_areas').select('id,name',{count:'exact'}).order('id').range(a,b))
 ]);
 const latest=new Map<string,Event>();
 for(const event of history){if(!latest.has(event.week_start))latest.set(event.week_start,event);}
 const entry=latest.get(week),closed=entry?.action==='closed';
 const labels:Record<string,string>={};
 for(const p of properties)labels['property:'+p.id]=p.name;
 for(const a of areas)labels['area:'+a.id]=a.name;
 const canClose=!closed&&sunday<today&&visits.length>0&&visits.every(v=>v.review_decision==='approved'&&!v.correction_pending);
 const base='/admin/workspaces/estates/weekly';
 const query=(format:'pdf'|'xlsx')=>'/api/admin/staff-week/export?profile='+encodeURIComponent(selected.id)+'&week='+encodeURIComponent(week)+'&format='+format;
 const dur=(n:number)=>Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'m';
 return <main className={s.adminPage}>
  <p><Link href="/admin/workspaces/staff">{tr('← Staff','← Personal')}</Link> · <Link href="/admin/workspaces/estates/operations">{tr('Operations Cockpit','Panel de operaciones')}</Link></p>
  <h1>{tr('Weekly time approval & closure','Aprobación y cierre semanal de horas')}</h1>
  <p>{tr('Select a staff member and an ISO week (Monday–Sunday). Review individual entries together, then close the completed week. No wages or invoices are created.','Seleccione empleado y semana ISO (lunes a domingo). Apruebe los registros y cierre la semana terminada. No se crean nóminas ni facturas.')}</p>
  <form method="get" className={s.filter}>
   <label>{tr('Staff member','Empleado')}<select name="profile" defaultValue={selected.id}>{people.map(p=><option key={p.id} value={p.id}>{p.full_name??p.email??p.id}</option>)}</select></label>
   <label>{tr('Week starting','Semana que comienza')}<input type="date" name="week" defaultValue={week} required/></label>
   <button>{tr('Show week','Mostrar semana')}</button>
  </form>
  <section className={s.panel}>
   <h2>{selected.full_name??tr('Staff member','Empleado')} · {week} – {sunday}</h2>
   <p>{tr('Status','Estado')}: <strong>{closed?tr('CLOSED','CERRADA'):entry?.action==='reopened'?tr('REOPENED · awaiting review','REABIERTA · pendiente'):tr('OPEN','ABIERTA')}</strong></p>
   {closed&&entry&&<><p>{tr('Frozen total','Total cerrado')}: <strong>{entry.visit_count} {tr('visits','visitas')} · {dur(entry.approved_minutes)}</strong>. {tr('Closed on','Cerrada el')} {entry.created_at.slice(0,10)}.</p>
    <p><a href={query('pdf')}>{tr('Download signed-off week PDF','Descargar PDF de la semana cerrada')}</a> · <a href={query('xlsx')}>{tr('Download Excel workbook (.xlsx)','Descargar libro Excel (.xlsx)')}</a></p></>}
   {sunday>=today&&<p>{tr('This week is still in progress. It can be reviewed now, but closed only after Sunday.','Esta semana está en curso. Puede revisarse, pero no cerrarse hasta después del domingo.')}</p>}
   {visits.some(v=>v.work_area_id==='zorgbalans'&&v.review_decision==='approved')&&<p><Link href="/admin/workspaces/estates/zorgbalans">{tr('Approved Zorgbalans visits → private billing cockpit (separate invoice confirmation)','Visitas Zorgbalans aprobadas → facturación privada (confirmación separada)')}</Link></p>}
  </section>
  <WeekControls profile={selected.id} week={week} rows={visits} closed={closed??false} canClose={canClose} labels={labels} locale={language==='es'?'es':'en'}/>
  <section className={s.panel}>
   <h2>{tr('Week closing history','Historial de cierre semanal')}</h2>
   {!latest.size?<p>{tr('No newly closed weeks yet. Historical WhatsApp weeks remain in Catherine’s separate archive.','Aún no hay semanas nuevas cerradas. Los informes antiguos de WhatsApp están en el archivo separado de Catherine.')}</p>:
    <ul>{[...latest].map(([date,e])=><li key={date}><Link href={base+'?profile='+encodeURIComponent(selected.id)+'&week='+date}>{date}</Link> · {e.action==='closed'?tr('Closed','Cerrada'):tr('Reopened','Reabierta')}{e.action==='closed'?' · '+dur(e.approved_minutes):''}</li>)}</ul>}
  </section>
 </main>;
}
