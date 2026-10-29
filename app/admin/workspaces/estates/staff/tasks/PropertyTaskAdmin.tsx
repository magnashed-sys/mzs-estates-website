'use client';
import {useActionState,useState} from 'react';
import {createPropertyTask,updatePropertyTask,updateTaskProgressAdmin} from './actions';
import type {PropertyTask,TaskStatus} from '../../../../../../lib/property-operations/property-tasks';
import {taskPriorityName,taskStatusName,taskOrder} from '../../../../../../lib/property-operations/property-tasks';
import s from '../../../../../staff/staff.module.css';
type Property={id:string;name:string;address?:string};
type Unit={id:string;property_id:string;address:string};
type Member={id:string;full_name:string;is_active:boolean};
type Scope={profile_id:string;property_id:string};
type Result={status:'idle'|'error'|'success';message:string};
const initial:Result={status:'idle',message:''};
function Message({data}:{data:Result}){return data.message&&<p className={data.status==='error'?s.error:s.confirm} role="status">{data.message}</p>;}
function TaskForm({properties,units,members,scopes,task,language}:{
 properties:Property[];units:Unit[];members:Member[];scopes:Scope[];task?:PropertyTask;language:'en'|'es';
}){
 const [state,action,pending]=useActionState(task?updatePropertyTask:createPropertyTask,initial);
 const [propertyId,setPropertyId]=useState(task?.property_id??properties[0]?.id??'');
 const [unitId,setUnitId]=useState(task?.unit_id??'');
 const [assignee,setAssignee]=useState(task?.assigned_profile_id??'');
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const candidates=members.filter(m=>m.is_active&&scopes.some(x=>x.profile_id===m.id&&x.property_id===propertyId));
 return <form className={s.form} action={action} style={{marginTop:16}}>
  {task&&<input type="hidden" name="task_id" value={task.id}/>}
  <input type="hidden" name="property_id" value={propertyId}/>
  <h3>{task?tr('Edit task and assignment','Editar tarea y asignación'):tr('Create a new task','Crear una nueva tarea')}</h3>
  <label>{tr('Property','Inmueble')}<select value={propertyId} disabled={!!task} onChange={e=>{setPropertyId(e.target.value);setUnitId('');setAssignee('');}} required>
   {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
  </select></label>
  <label>{tr('Unit (optional)','Unidad (opcional)')}<select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
   <option value="">{tr('Whole property / general','Inmueble completo / general')}</option>
   {units.filter(u=>u.property_id===propertyId).map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
  </select></label>
  <label>{tr('Assigned property manager','Gestor asignado')}<select name="assigned_profile_id" value={assignee} onChange={e=>setAssignee(e.target.value)}>
   <option value="">{tr('Unassigned · admin inbox','Sin asignar · bandeja del administrador')}</option>
   {candidates.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}
  </select></label>
  <label>{tr('Title','Título')}<input name="title" defaultValue={task?.title??''} required minLength={5} maxLength={160}/></label>
  <label>{tr('Description / instructions','Descripción / instrucciones')}<textarea name="description" rows={3} defaultValue={task?.description??''} maxLength={2000}/></label>
  <div className={s.two}>
   <label>{tr('Priority','Prioridad')}<select name="priority" defaultValue={task?.priority??'normal'}>
    {Object.entries(taskPriorityName).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></label>
   <label>{tr('Due date (optional)','Fecha límite (opcional)')}<input type="date" name="due_on" defaultValue={task?.due_on??''}/></label>
  </div>
  <label>{tr('Source reference (optional)','Referencia de origen (opcional)')}<input name="source_reference" defaultValue={task?.source_reference??''} maxLength={250}/></label>
  <button disabled={pending}>{pending?tr('Saving…','Guardando…'):task?tr('Save changes','Guardar cambios'):tr('Create task','Crear tarea')}</button>
  <Message data={state}/>
 </form>;
}
function Progress({task,language}:{task:PropertyTask;language:'en'|'es'}){
 const [data,action,pending]=useActionState(updateTaskProgressAdmin,initial);
 const tr=(en:string,es:string)=>language==='es'?es:en;
 return <form action={action} className={s.form} style={{marginTop:16}}>
  <input type="hidden" name="task_id" value={task.id}/>
  <label>{tr('New status','Nuevo estado')}<select name="status" defaultValue={task.status}>
   {Object.entries(taskStatusName).map(([key,label])=><option key={key} value={key}>{label}</option>)}
  </select></label>
  <label>{tr('Progress note / reason','Nota de progreso / motivo')}<textarea name="note" rows={2} minLength={3} maxLength={1500} required/></label>
  <button disabled={pending}>{pending?tr('Saving…','Guardando…'):tr('Update status','Actualizar estado')}</button>
  <Message data={data}/>
 </form>;
}
export default function PropertyTaskAdmin({properties,units,members,scopes,tasks,language,timeTotals}:{
 properties:Property[];units:Unit[];members:Member[];scopes:Scope[];tasks:PropertyTask[];language:'en'|'es';timeTotals:{task_id:string;minutes:number;visits:number}[];
}){
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const [filter,setFilter]=useState<'active'|'all'|'done'>('active');
 const visible=taskOrder(tasks).filter(t=>filter==='all'||(filter==='done'?t.status==='done':!['done','cancelled'].includes(t.status)));
 const props=new Map(properties.map(x=>[x.id,x])),people=new Map(members.map(x=>[x.id,x]));
 return <div>
  <details className={s.panel}><summary>+ {tr('New task','Nueva tarea')}</summary>
   <TaskForm properties={properties} units={units} members={members} scopes={scopes} language={language}/>
  </details>
  <div className={s.taskTabs} role="group" aria-label={tr('Task filter','Filtro de tareas')}>
   {(['active','all','done'] as const).map(key=><button className={filter===key?s.taskTabActive:s.taskTab} type="button" key={key} onClick={()=>setFilter(key)}>{key==='active'?tr('Open','Abiertas'):key==='done'?tr('Completed','Completadas'):tr('All','Todas')}</button>)}
  </div>
  <div className={s.taskCardList}>
   {visible.map(t=><article key={t.id} className={s.taskCard}>
    <div className={s.taskCardTop}><strong>{t.title}</strong><span className={s.taskChip}>{taskStatusName[t.status]}</span></div>
    <p className={s.taskMeta}>{props.get(t.property_id)?.name??tr('Property','Inmueble')}{t.unit_id?' · '+(units.find(u=>u.id===t.unit_id)?.address??tr('Unit','Unidad')):''}</p>
    <p className={s.taskMeta}>{tr('Assigned to','Asignado a')}: {people.get(t.assigned_profile_id??'')?.full_name??tr('Unassigned','Sin asignar')} · {taskPriorityName[t.priority]}{t.due_on?' · '+t.due_on:''}</p>
    <p className={s.taskMeta}>{tr('Working time registered','Gastos de tiempo registrados')}: {((timeTotals.find(x=>x.task_id===t.id)?.minutes??0)/60).toFixed(2)} h · {timeTotals.find(x=>x.task_id===t.id)?.visits??0} {tr('visits','visitas')} ({tr('not yet billable','todavía no facturable')})</p>
    {t.description&&<p>{t.description}</p>}
    {t.latest_note&&<p className={s.taskMeta}>{tr('Latest','Última actualización')}: {t.latest_note}</p>}
    <div className={s.taskDetails}>
     <details><summary>{tr('Edit / reassign','Editar / reasignar')}</summary><TaskForm task={t} properties={properties} units={units} members={members} scopes={scopes} language={language}/></details>
     <details><summary>{tr('Status and follow-up','Estado y seguimiento')}</summary><Progress task={t} language={language}/></details>
    </div>
   </article>)}
   {!visible.length&&<p className={s.note}>{tr('No tasks in this selection.','No hay tareas en esta selección.')}</p>}
  </div>
 </div>;
}
