'use client';
import {useActionState,useState} from 'react';
import {createMyPropertyTask,updateMyTaskProgress} from './task-actions';
import {reportMaintenanceTicket} from './actions';
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
type EntryKind='task'|'maintenance';
function NewWorkItem({properties,units,profileId}:{properties:Property[];units:Unit[];profileId:string}){
 const [taskState,taskAction,taskPending]=useActionState(createMyPropertyTask,initial);
 const [maintenanceState,maintenanceAction,maintenancePending]=useActionState(reportMaintenanceTicket,initial);
 const [kind,setKind]=useState<EntryKind>('task');
 const [propertyId,setPropertyId]=useState(properties[0]?.id??'');
 const [unitId,setUnitId]=useState('');
 const isMaintenance=kind==='maintenance';
 const result=isMaintenance?maintenanceState:taskState;
 const pending=isMaintenance?maintenancePending:taskPending;
 return <section id="work-create" className={s.taskCreate} aria-labelledby="work-create-title">
  <form key={kind} className={s.form} action={isMaintenance?maintenanceAction:taskAction}>
   <h2 id="work-create-title">New task or report</h2>
   <p className={s.description}>Choose what you need to record. Both options will be visible to your manager.</p>
   <label>What would you like to add?
    <select value={kind} onChange={e=>setKind(e.target.value as EntryKind)}>
     <option value="task">Task / general work</option>
     <option value="maintenance">Maintenance issue / repair request</option>
    </select>
   </label>
   <input type="hidden" name="property_id" value={propertyId}/>
   {!isMaintenance&&<>
    <input type="hidden" name="assigned_profile_id" value={profileId}/>
    <input type="hidden" name="source_reference" value=""/>
   </>}
   {properties.length>1?<label>Property
    <select value={propertyId} onChange={e=>{setPropertyId(e.target.value);setUnitId('');}} required>
     {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
   </label>:<p className={s.taskMeta}>Property: {properties[0]?.name??'No assigned property'}</p>}
   {units.some(u=>u.property_id===propertyId)&&<label>Unit (optional)
    <select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
     <option value="">Whole property / common area</option>
     {units.filter(u=>u.property_id===propertyId).map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
    </select>
   </label>}
   <label>{isMaintenance?'What needs repairing?':'What needs to be done?'}
    <input name="title" minLength={5} maxLength={140} required placeholder={isMaintenance?'e.g. Leaking tap in kitchen':'e.g. Order towels for toilets'}/>
   </label>
   <label>{isMaintenance?'Describe the issue':'Details (optional)'}
    <textarea name="description" rows={3} minLength={isMaintenance?8:undefined}
     maxLength={2000} required={isMaintenance}
     placeholder={isMaintenance?'What is wrong and where?':'Add any instructions or useful details'}/>
   </label>
   <label>{isMaintenance?'Urgency':'Priority'}
    <select key={kind} name="priority" defaultValue={isMaintenance?'routine':'normal'}>
     {isMaintenance?<>
      <option value="routine">Normal</option>
      <option value="soon">Needs attention soon</option>
      <option value="urgent">Urgent</option>
     </>:<>
      <option value="normal">Normal</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
      <option value="low">Low</option>
     </>}
    </select>
   </label>
   {!isMaintenance&&<details className={s.taskOptional}>
    <summary>Additional planning (optional)</summary>
    <label>Due date <input name="due_on" type="date"/></label>
   </details>}
   {isMaintenance&&<p className={s.description}>This creates a maintenance report for review. It does not automatically authorize a supplier or create an invoice. For immediate danger, call the responsible manager.</p>}
   <button disabled={pending||!propertyId} type="submit">{pending?'Saving…':isMaintenance?'Send maintenance report':'Create task'}</button>
   <Message state={result}/>
  </form>
 </section>;
}
export default function StaffTaskBoard({tasks,properties,units,profileId,today}:{
 tasks:PropertyTask[];properties:Property[];units:Unit[];profileId:string;today:string;
}){
 const [showAll,setShowAll]=useState(false);
 const [showNew,setShowNew]=useState(false);
 const summary=taskOverview(tasks,today);
 const list=taskOrder(tasks).filter(t=>showAll||!['done','cancelled'].includes(t.status));
 const prop=new Map(properties.map(p=>[p.id,p.name]));
 const unit=new Map(units.map(u=>[u.id,u.address]));
 return <section className={s.staffTasks} aria-labelledby="staff-tasks-title">
  <div className={s.mobileHead}>
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
   <button type="button" className={s.taskPrimary} aria-expanded={showNew}
    aria-controls="work-create" onClick={()=>setShowNew(x=>!x)}>+ New task / report</button>
   <a className={s.taskSecondary} href="#hours">+ Log working time</a>
  </div>
  {showNew&&<NewWorkItem properties={properties} units={units} profileId={profileId}/>} 
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
  {!list.length&&<p className={s.note}>No open tasks yet. Use “New task / report” to add work, or wait for your manager to assign it.</p>}</div>
  <p className={s.taskDisclaimer}>Only your assigned properties and tasks are visible. Tasks and worked hours do not issue invoices or make payments.</p>
 </section>;
}
