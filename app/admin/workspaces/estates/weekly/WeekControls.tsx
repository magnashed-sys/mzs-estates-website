'use client';
import {useActionState,useEffect,useState} from 'react';
import {approveSelectedWeekVisits,closeStaffWeek,reopenStaffWeek,type WeekActionState} from './actions';
import s from '../../../../staff/staff.module.css';
const initial:WeekActionState={status:'idle',message:''};
export type WeekRow={id:string;worked_on:string;actual_minutes:number;effective_minutes:number;
 description:string;work_area_id:string|null;property_id:string|null;unit_id:string|null;
 review_decision:string|null;correction_pending:boolean;correction_id:string|null;task_category:string};
const duration=(n:number)=>Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'m';
export default function WeekControls({profile,week,rows,closed,canClose,labels,locale}:{profile:string;week:string;rows:WeekRow[];closed:boolean;canClose:boolean;labels:Record<string,string>;locale:'en'|'es'}){
 const [selected,setSelected]=useState<string[]>([]);
 const [approval,approve,pendingApprove]=useActionState(approveSelectedWeekVisits,initial);
 const [closure,close,pendingClose]=useActionState(closeStaffWeek,initial);
 const [reopenState,reopen,pendingReopen]=useActionState(reopenStaffWeek,initial);
 useEffect(()=>{if(approval.status==='success')setSelected([]);},[approval]);
 const tr=(en:string,es:string)=>locale==='es'?es:en;
 const ready=rows.filter(r=>r.review_decision===null&&!r.correction_pending);
 const toggle=(id:string,checked:boolean)=>setSelected(prev=>checked?[...new Set([...prev,id])]:prev.filter(x=>x!==id));
 const status=(r:WeekRow)=>r.correction_pending?tr('Correction pending','Corrección pendiente'):r.review_decision==='approved'?tr('Approved','Aprobada'):r.review_decision==='rejected'?tr('Returned','Devuelta'):tr('Needs review','Pendiente');
 return <section className={s.panel}>
  <h2>{tr('Week visits and approval','Visitas y aprobación de la semana')}</h2>
  <p>{rows.length} {tr('visits','visitas')} · {duration(rows.reduce((a,r)=>a+r.effective_minutes,0))} {tr('recorded','registradas')} · {rows.filter(r=>r.review_decision==='approved'&&!r.correction_pending).length} {tr('approved','aprobadas')}</p>
  {rows.length?<form action={approve} className={s.form}>
   <input type="hidden" name="profile" value={profile}/><input type="hidden" name="week" value={week}/>
   <div className={s.tableWrap}><table className={s.table}><thead><tr>
    <th><input aria-label={tr('Select all pending visits','Seleccionar todas las visitas pendientes')} type="checkbox" checked={ready.length>0&&selected.length===ready.length} disabled={closed||!ready.length} onChange={e=>setSelected(e.target.checked?ready.slice(0,100).map(x=>x.id):[])}/></th>
    <th>{tr('Date / location','Fecha / lugar')}</th><th>{tr('Work and duration','Trabajo y duración')}</th><th>{tr('Status','Estado')}</th>
   </tr></thead><tbody>{rows.map(r=><tr key={r.id}>
    <td>{!closed&&r.review_decision===null&&!r.correction_pending?
     <input type="checkbox" name="visit_id" value={r.id} checked={selected.includes(r.id)} disabled={selected.length>=100&&!selected.includes(r.id)} onChange={e=>toggle(r.id,e.target.checked)} aria-label={tr('Select visit on ','Seleccionar visita del ')+r.worked_on}/>:null}</td>
    <td>{r.worked_on}<br/><small>{r.work_area_id?labels['area:'+r.work_area_id]:labels['property:'+r.property_id]??tr('Property','Inmueble')}</small></td>
    <td>{duration(r.effective_minutes)}<br/><small>{r.description}</small></td>
    <td>{status(r)}</td>
   </tr>)}</tbody></table></div>
   {!closed&&<><label>{tr('Approval reason','Motivo de aprobación')}<textarea name="note" minLength={12} maxLength={500} required defaultValue="Weekly timesheet checked by Group Admin."/></label>
    <button disabled={pendingApprove||selected.length===0}>{pendingApprove?tr('Saving…','Guardando…'):tr('Approve selected visits','Aprobar visitas seleccionadas')+' ('+selected.length+')'}</button></>}
   {approval.message&&<p role="status" className={approval.status==='error'?s.error:s.confirm}>{approval.message}</p>}
  </form>:<p>{tr('No registered visits this week.','No hay visitas registradas esta semana.')}</p>}
  {!closed&&<form action={close} className={s.form}>
   <input type="hidden" name="profile" value={profile}/><input type="hidden" name="week" value={week}/>
   <h3>{tr('Close the full week','Cerrar la semana completa')}</h3>
   <p>{tr('Allowed only after Sunday, once every entry is approved and corrections are resolved. This creates an immutable snapshot.','Disponible después del domingo, cuando todas las visitas estén aprobadas y sin correcciones pendientes. Genera una copia inmutable.')}</p>
   <label>{tr('Closure reason','Motivo del cierre')}<textarea name="note" minLength={12} maxLength={500} required defaultValue="Weekly time review completed and reconciled."/></label>
   <button disabled={pendingClose||!canClose}>{pendingClose?tr('Closing…','Cerrando…'):tr('Close approved week','Cerrar semana aprobada')}</button>
   {closure.message&&<p role="status" className={closure.status==='error'?s.error:s.confirm}>{closure.message}</p>}
  </form>}
  {closed&&<form action={reopen} className={s.form}>
   <input type="hidden" name="profile" value={profile}/><input type="hidden" name="week" value={week}/>
   <h3>{tr('Controlled reopening','Reapertura controlada')}</h3>
   <p>{tr('Requires an explanation and cannot reopen weeks with already invoiced Zorgbalans visits. Prior closure snapshots remain preserved.','Requiere explicación y no permite reabrir semanas con visitas Zorgbalans ya facturadas. Se conservan los cierres anteriores.')}</p>
   <label>{tr('Reopening explanation','Motivo de reapertura')}<textarea name="note" minLength={12} maxLength={500} required/></label>
   <button disabled={pendingReopen}>{tr('Reopen week for correction','Reabrir semana para corrección')}</button>
   {reopenState.message&&<p role="status" className={reopenState.status==='error'?s.error:s.confirm}>{reopenState.message}</p>}
  </form>}
 </section>;
}
