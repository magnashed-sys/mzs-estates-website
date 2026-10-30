'use client';
import {useActionState,useState} from 'react';
import {saveRecurringPlan,generateRecurringTasks,type Result} from './actions';
import {recurrenceDate,firstRecurrenceIndex,type RecurringPlan} from '../../../../../../lib/property-operations/recurring-tasks';
import s from './recurring.module.css';
export type Choices={properties:{id:string;name:string}[];areas:{id:string;name:string}[];units:{id:string;property_id:string;address:string}[];members:{id:string;full_name:string;is_active:boolean}[];scopes:{profile_id:string;property_id:string}[];areaScopes:{profile_id:string;area_id:string}[]};
const idle:Result={status:'idle',message:''};
function Feedback({result,es}:{result:Result;es:boolean}){
 const messages:Record<string,string>={saved:es?'Plan guardado. Los cambios se aplican a futuras tareas.':'Plan saved. Changes apply to future tasks.',stale:es?'El plan ha cambiado. Actualice la página antes de guardar.':'This plan changed. Refresh before saving.',invalid:es?'Revise las fechas, la ubicación, la unidad y el acceso del empleado. Una nueva programación debe empezar hoy o después.':'Check dates, location, unit and employee access. A new schedule must start today or later.',generation_failed:es?'No se pudieron generar las tareas.':'Tasks could not be generated.'};
 let text=messages[result.message]||'';
 if(result.message.startsWith('{')){try{const x=JSON.parse(result.message);text=es?`${x.created} tareas creadas; ${x.errors} planes requieren revisión.`:`${x.created} tasks created; ${x.errors} plans need attention.`;}catch{text='';}}
 return result.status==='idle'?null:<p role={result.status==='error'?'alert':'status'} className={result.status==='error'?s.error:s.success}>{text}</p>;
}
export function GenerateButton({es}:{es:boolean}){
 const [result,action,pending]=useActionState(generateRecurringTasks,idle);
 return <form action={action}><button className={s.button} disabled={pending}>{pending?(es?'Procesando…':'Processing…'):(es?'Generar tareas pendientes ahora':'Generate due tasks now')}</button><Feedback result={result} es={es}/></form>;
}
export default function PlanForm({id,plan,choices,today,es}:{id:string;plan?:RecurringPlan;choices:Choices;today:string;es:boolean}){
 const tr=(en:string,spanish:string)=>es?spanish:en;
 const [result,action,pending]=useActionState(saveRecurringPlan,idle);
 const [location,setLocation]=useState(plan?.property_id?'p:'+plan.property_id:plan?.work_area_id?'a:'+plan.work_area_id:'');
 const [unit,setUnit]=useState(plan?.unit_id||'');const [assignee,setAssignee]=useState(plan?.assigned_profile_id||'');
 const [frequency,setFrequency]=useState(plan?.frequency||'weekly'),[every,setEvery]=useState(plan?.every_n||1),[start,setStart]=useState(plan?.start_on||today),[end,setEnd]=useState(plan?.end_on||'');
 const property=location.startsWith('p:')?location.slice(2):'',area=location.startsWith('a:')?location.slice(2):'';
 const eligible=choices.members.filter(m=>m.is_active&&(property?choices.scopes.some(g=>g.profile_id===m.id&&g.property_id===property):choices.areaScopes.some(g=>g.profile_id===m.id&&g.area_id===area)));
 const [active,setActive]=useState(plan?.is_active??true);
 let base=plan&&start===plan.start_on&&frequency===plan.frequency&&every===plan.every_n?plan.occurrence_no:0;
 let preview:string[]=[];try{if(plan&&!plan.is_active&&active&&start===plan.start_on&&frequency===plan.frequency&&every===plan.every_n)base=Math.max(base,firstRecurrenceIndex(start,frequency,every,today));preview=Array.from({length:5},(_,i)=>recurrenceDate(start,frequency,every,base+i)).filter(d=>d<='2099-12-31'&&(!end||d<=end));}catch{/* Editable incomplete input has no preview. */}
 return <form action={action} className={s.form}>
 <input type='hidden' name='id' value={id}/><input type='hidden' name='revision' value={plan?.revision||0}/><input type='hidden' name='property_id' value={property}/><input type='hidden' name='work_area_id' value={area}/>
 <label className={s.full}>{tr('Task title','Título de la tarea')}<input name='title' minLength={5} maxLength={160} required defaultValue={plan?.title}/></label>
 <label className={s.full}>{tr('Description','Descripción')}<textarea name='description' maxLength={2000} defaultValue={plan?.description}/></label>
 <label>{tr('Location','Ubicación')}<select value={location} required onChange={e=>{setLocation(e.target.value);setUnit('');setAssignee('');}}><option value=''>{tr('Choose a location','Seleccione una ubicación')}</option>{choices.properties.map(p=><option key={p.id} value={'p:'+p.id}>{p.name}</option>)}{choices.areas.map(a=><option key={a.id} value={'a:'+a.id}>{a.name}</option>)}</select></label>
 <label>{tr('Unit (optional)','Unidad (opcional)')}<select name='unit_id' value={unit} onChange={e=>setUnit(e.target.value)} disabled={!property}><option value=''>{tr('Entire location','Toda la ubicación')}</option>{choices.units.filter(u=>u.property_id===property).map(u=><option key={u.id} value={u.id}>{u.address}</option>)}</select>{!property&&<input type='hidden' name='unit_id' value=''/>}</label>
 <label>{tr('Employee','Empleado')}<select name='assigned_profile_id' required value={assignee} onChange={e=>setAssignee(e.target.value)}><option value=''>{tr('Choose an authorized employee','Seleccione un empleado autorizado')}</option>{assignee&&!eligible.some(m=>m.id===assignee)&&<option value={assignee}>{choices.members.find(m=>m.id===assignee)?.full_name||tr('Previous employee','Empleado anterior')} · {tr('access unavailable','sin acceso')}</option>}{eligible.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
 <label>{tr('Priority','Prioridad')}<select name='priority' defaultValue={plan?.priority||'normal'}>{['low','normal','high','urgent'].map((v,i)=><option key={v} value={v}>{(es?['Baja','Normal','Alta','Urgente']:['Low','Normal','High','Urgent'])[i]}</option>)}</select></label>
 <label>{tr('Repeat','Repetición')}<select name='frequency' value={frequency} onChange={e=>setFrequency(e.target.value)}><option value='daily'>{tr('Days','Días')}</option><option value='weekly'>{tr('Weeks','Semanas')}</option><option value='monthly'>{tr('Months','Meses')}</option></select></label>
 <label>{tr('Every','Cada')}<input name='every_n' type='number' min={1} max={365} step={1} required value={every} onChange={e=>setEvery(Number(e.target.value))}/></label>
 <label>{tr('First due date','Primera fecha límite')}<input name='start_on' type='date' required value={start} min={plan?undefined:today} max='2099-12-31' onChange={e=>setStart(e.target.value)}/></label>
 <label>{tr('End date (optional)','Fecha final (opcional)')}<input name='end_on' type='date' value={end} min={start} max='2099-12-31' onChange={e=>setEnd(e.target.value)}/></label>
 <label>{tr('Create task this many days ahead','Crear la tarea estos días antes')}<input name='lead_days' type='number' min={0} max={30} step={1} required defaultValue={plan?.lead_days||0}/></label>
 <label className={s.check}><input name='is_active' type='checkbox' checked={active} onChange={e=>setActive(e.target.checked)}/>{tr('Active schedule','Programación activa')}</label>
 <div className={s.full+' '+s.preview}><strong>{tr('Next due dates','Próximas fechas límite')}</strong><br/>{preview.length?preview.join(' · '):tr('No dates in this selection','Sin fechas en esta selección')}<br/><small>{tr('Europe/Madrid. Month-end dates are clamped to the last day and retain their original anchor.','Europe/Madrid. Las fechas de fin de mes se ajustan al último día y conservan su referencia original.')}</small></div>
 <p className={s.full+' '+s.muted}>{tr('Saving an active plan enables automatic task creation. Pausing keeps existing tasks. Resuming skips past dates; changing the schedule starts a new future series. Existing tasks and recorded time are never rewritten.','Guardar un plan activo habilita la creación automática de tareas. Pausar conserva las tareas existentes. Reanudar omite fechas pasadas; cambiar la programación inicia una nueva serie futura. No se modifican tareas ni horas ya registradas.')}</p>
 <div className={s.full}><button className={s.button} disabled={pending}>{pending?tr('Saving…','Guardando…'):tr('Save recurring plan','Guardar plan recurrente')}</button><Feedback result={result} es={es}/></div>
 </form>;
}
