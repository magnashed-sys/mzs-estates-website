'use client';
import {useActionState,useState} from 'react';
import {createMyPropertyTask,updateMyTaskProgress} from './task-actions';
import {taskOverview,taskOrder,taskPriorityName,taskStatusName,type PropertyTask} from '../../lib/property-operations/property-tasks';
import s from './staff.module.css';
type Property={id:string;name:string;address:string};
type Unit={id:string;property_id:string;address:string};
type Result={status:'idle'|'success'|'error';message:string};
const initial:Result={status:'idle',message:''};
function Message({state}:{state:Result}){return state.message&&<p role="status" className={state.status==='error'?s.error:s.confirm}>{state.message}</p>;}
function Progress({task}:{task:PropertyTask}){
 const [state,action,pending]=useActionState(updateMyTaskProgress,initial);
 return <form className={s.taskProgressForm} action={action}>
  <input type="hidden" name="task_id" value={task.id}/>
  <label>Update status
   <select name="status" defaultValue={task.status==='open'?'in_progress':task.status==='done'?'done':task.status}>
    <option value="in_progress">In progress</option><option value="blocked">Waiting / blocked</option><option value="done">Completed</option>
   </select>
  </label>
  <label>Progress note <textarea name="note" minLength={3} maxLength={1500} rows={2} required placeholder="What has been done, or what is still needed?"/></label>
  <button type="submit" disabled={pending}>{pending?'Saving…':'Save progress'}</button>
  <Message state={state}/>
 </form>;
}
function NewTask({properties,units,profileId}:{properties:Property[];units:Unit[];profileId:string}){
 const [state,action,pending]=useActionState(createMyPropertyTask,initial);
 const [propertyId,setPropertyId]=useState(properties[0]?.id??''),[unitId,setUnitId]=useState('');
 return <details id="task-create" className={s.taskCreate}>
  <summary>+ Create a task</summary>
  <form className={s.form} action={action}>
   <input type="hidden" name="property_id" value={propertyId}/>
   <input type="hidden" name="assigned_profile_id" value={profileId}/>
   <input type="hidden" name="source_reference" value=""/>
   <h2>New task</h2>
   <label>Property<select value={propertyId} onChange={e=>{setPropertyId(e.target.value);setUnitId('');}} required>
    {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
   </select></label>
   <label>Unit<select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
    <option value="">Whole property / general</option>
    {units.filter(u=>u.property_id===propertyId).map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
   </select></label>
   <label>Task title<input name="title" minLength={5} maxLength={160} required placeholder="What needs to be done?"/></label>
   <label>Details<textarea name="description" rows={3} maxLength={2000} placeholder="What and where?"/></label>
   <div className={s.two}>
    <label>Priority<select name="priority" defaultValue="normal">
     {Object.entries(taskPriorityName).map(([k,v])=><option key={k} value={k}>{v}</option>)}
    </select></label>
    <label>Due date (optional)<input name="due_on" type="date"/></label>
   </div>
   <button disabled={pending} type="submit">{pending?'Saving…':'Create task'}</button><Message state={state}/>
  </form>
 </details>;
}
export default function StaffTaskBoard({tasks,properties,units,profileId,today}:{
 tasks:PropertyTask[];properties:Property[];units:Unit[];profileId:string;today:string;
}){
 const [showAll,setShowAll]=useState(false);
 const summary=taskOverview(tasks,today);
 const list=taskOrder(tasks).filter(t=>showAll||!['done','cancelled'].includes(t.status));
 const prop=new Map(properties.map(p=>[p.id,p.name]));
 const unit=new Map(units.map(u=>[u.id,u.address]));
 return <section className={s.staffTasks} aria-labelledby="staff-tasks-title">
  <div className={s.mobileHead}><p className={s.kicker}>MY PROPERTY MANAGEMENT</p>
   <h2 id="staff-tasks-title">My tasks</h2>
   <p>See what needs attention and record progress directly from your phone.</p>
  </div>
  <div className={s.mobileStats}>
   <div><small>Open tasks</small><strong>{summary.open}</strong></div>
   <div><small>Due / no date</small><strong>{summary.today}</strong></div>
   <div><small>High priority</small><strong>{summary.urgent}</strong></div>
   <div><small>Completed</small><strong>{summary.completed}</strong></div>
  </div>
  <div className={s.taskActions}>
   <a className={s.taskPrimary} href="#hours">+ Log working time</a>
   <a className={s.taskSecondary} href="#task-create">+ Add task</a>
  </div>
  <NewTask properties={properties} units={units} profileId={profileId}/>
  <div className={s.taskTabs} role="group" aria-label="Task status filter">
   <button type="button" className={!showAll?s.taskTabActive:s.taskTab} onClick={()=>setShowAll(false)}>Open ({summary.open})</button>
   <button type="button" className={showAll?s.taskTabActive:s.taskTab} onClick={()=>setShowAll(true)}>All tasks</button>
  </div>
  <div className={s.taskCardList}>{list.map(task=><article className={s.taskCard} key={task.id}>
   <div className={s.taskCardTop}><strong>{task.title}</strong><span className={s.taskChip}>{taskStatusName[task.status]}</span></div>
   <p className={s.taskMeta}>{prop.get(task.property_id)??'Property'}{task.unit_id?' · '+(unit.get(task.unit_id)??'Unit'):''}</p>
   <p className={s.taskMeta}>{taskPriorityName[task.priority]}{task.due_on?' · Due '+task.due_on:''}</p>
   {task.description&&<p>{task.description}</p>}
   {task.latest_note&&<p className={s.taskMeta}>Last update: {task.latest_note}</p>}
   {task.status!=='done'&&task.status!=='cancelled'&&<details className={s.taskDetails}><summary>Update progress</summary><Progress task={task}/></details>}
  </article>)}
  {!list.length&&<p className={s.note}>No open tasks yet. Use “Add task” to create one, or wait for your manager to assign work.</p>}</div>
  <p className={s.taskDisclaimer}>Only your assigned properties and tasks are visible. Tasks and worked hours do not issue invoices or make payments.</p>
 </section>;
}
