'use client';
import {useActionState,useState} from 'react';
import {createMyPropertyTask,updateMyTaskProgress} from './task-actions';
import {reportMaintenanceTicket} from './actions';
import {taskOverview,taskOrder,taskPriorityName,taskStatusName,type PropertyTask} from '../../lib/property-operations/property-tasks';
import s from './staff.module.css';
import {staffText,type StaffLanguage} from '../../lib/property-operations/staff-copy';
type Property={id:string;name:string;address:string};
type Unit={id:string;property_id:string;address:string};
type Result={status:'idle'|'success'|'error';message:string};
const initial:Result={status:'idle',message:''};
function Message({state}:{state:Result}){return state.message&&<p role="status" className={state.status==='error'?s.error:s.confirm}>{state.message}</p>;}
function Progress({task,language}:{task:PropertyTask;language:StaffLanguage}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [state,action,pending]=useActionState(updateMyTaskProgress,initial);
 return <form className={s.taskProgressForm} action={action}>
  <input type="hidden" name="task_id" value={task.id}/>
  <label>{t('progress')}
   <select name="status" defaultValue={task.status==='open'?'in_progress':task.status==='done'?'done':task.status}>
    <option value="in_progress">{t('taskProgress')}</option><option value="blocked">{t('taskBlocked')}</option><option value="done">{t('taskDone')}</option>
   </select>
  </label>
  <label>{t('progressNote')} <textarea name="note" minLength={3} maxLength={1500} rows={2} required placeholder="What has been done, or what is still needed?"/></label>
  <button type="submit" disabled={pending}>{pending?t('saving'):t('saveProgress')}</button>
  <Message state={state}/>
 </form>;
}
type EntryKind='task'|'maintenance';
function NewWorkItem({properties,units,profileId,language}:{properties:Property[];units:Unit[];profileId:string;language:StaffLanguage}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
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
   <h2 id="work-create-title">{t('createHeading')}</h2>
   
   <label>{t('addType')}
    <select value={kind} onChange={e=>setKind(e.target.value as EntryKind)}>
     <option value="task">{t('task')}</option>
     <option value="maintenance">{t('maintenance')}</option>
    </select>
   </label>
   <input type="hidden" name="property_id" value={propertyId}/>
   {!isMaintenance&&<>
    <input type="hidden" name="assigned_profile_id" value={profileId}/>
    <input type="hidden" name="source_reference" value=""/>
   </>}
   {properties.length>1?<label>{t('property')}
    <select value={propertyId} onChange={e=>{setPropertyId(e.target.value);setUnitId('');}} required>
     {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
   </label>:<p className={s.taskMeta}>{t("property")}: {properties[0]?.name??'No assigned property'}</p>}
   {units.some(u=>u.property_id===propertyId)&&<label>{t('unit')}
    <select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
     <option value="">{t('whole')}</option>
     {units.filter(u=>u.property_id===propertyId).map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
    </select>
   </label>}
   <label>{t(isMaintenance?'issueTitle':'taskTitle')}
    <input name="title" minLength={5} maxLength={140} required placeholder={isMaintenance?'e.g. Leaking tap in kitchen':'e.g. Order towels for toilets'}/>
   </label>
   <label>{t(isMaintenance?'description':'details')}
    <textarea name="description" rows={3} minLength={isMaintenance?8:undefined}
     maxLength={2000} required={isMaintenance}
     placeholder={isMaintenance?'What is wrong and where?':'Add any instructions or useful details'}/>
   </label>
   <label>{t(isMaintenance?'urgency':'priority')}
    <select key={kind} name="priority" defaultValue={isMaintenance?'routine':'normal'}>
     {isMaintenance?<>
      <option value="routine">{t('normal')}</option>
      <option value="soon">{t('soon')}</option>
      <option value="urgent">{t('urgent')}</option>
     </>:<>
      <option value="normal">Normal</option>
      <option value="high">{t('high')}</option>
      <option value="urgent">Urgent</option>
      <option value="low">{t('low')}</option>
     </>}
    </select>
   </label>
   {!isMaintenance&&<details className={s.taskOptional}>
    <summary>{t('planning')}</summary>
    <label>{t('dueDate')} <input name="due_on" type="date"/></label>
   </details>}
   {isMaintenance&&<p className={s.description}>{t('photoWarning')}</p>}
   <button disabled={pending||!propertyId} type="submit">{pending?t('saving'):t(isMaintenance?'sendReport':'createTask')}</button>
   <Message state={result}/>
  </form>
 </section>;
}
export default function StaffTaskBoard({tasks,properties,units,profileId,today,language}:{
 tasks:PropertyTask[];properties:Property[];units:Unit[];profileId:string;today:string;language:StaffLanguage;
}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [showAll,setShowAll]=useState(false);
 const [showNew,setShowNew]=useState(false);
 const summary=taskOverview(tasks,today);
 const list=taskOrder(tasks).filter(t=>showAll||!['done','cancelled'].includes(t.status));
 const prop=new Map(properties.map(p=>[p.id,p.name]));
 const unit=new Map(units.map(u=>[u.id,u.address]));
 return <section className={s.staffTasks} aria-labelledby="staff-tasks-title">
  <div className={s.mobileHead}>
   <h2 id="staff-tasks-title">{t('tasks')}</h2>

  </div>
  <div className={s.mobileStats}>
   <div><small>{t('openTasks')}</small><strong>{summary.open}</strong></div>
   <div><small>{t('dueToday')}</small><strong>{summary.today}</strong></div>
   <div><small>{t('priorityHigh')}</small><strong>{summary.urgent}</strong></div>
   <div><small>{t('completed')}</small><strong>{summary.completed}</strong></div>
  </div>
  <div className={s.taskActions}>
   <button type="button" className={s.taskPrimary} aria-expanded={showNew}
    aria-controls="work-create" onClick={()=>setShowNew(x=>!x)}>{t('newEntry')}</button>
   <a className={s.taskSecondary} href="#hours">{t('logTime')}</a>
  </div>
  {showNew&&<NewWorkItem properties={properties} units={units} profileId={profileId} language={language}/>} 
  <div className={s.taskTabs} role="group" aria-label="Task status filter">
   <button type="button" className={!showAll?s.taskTabActive:s.taskTab} onClick={()=>setShowAll(false)} >{t('taskOpen')} ({summary.open})</button>
   <button type="button" className={showAll?s.taskTabActive:s.taskTab} onClick={()=>setShowAll(true)}>{t('allTasks')}</button>
  </div>
  <div className={s.taskCardList}>{list.map(task=><article className={s.taskCard} key={task.id}>
   <div className={s.taskCardTop}><strong>{task.title}</strong><span className={s.taskChip}>{t(task.status==='open'?'taskOpen':task.status==='in_progress'?'taskProgress':task.status==='blocked'?'taskBlocked':task.status==='done'?'taskDone':'taskCancelled')}</span></div>
   <p className={s.taskMeta}>{prop.get(task.property_id)??'Property'}{task.unit_id?' · '+(unit.get(task.unit_id)??'Unit'):''}</p>
   <p className={s.taskMeta}>{taskPriorityName[task.priority]}{task.due_on?' · Due '+task.due_on:''}</p>
   {task.description&&<p>{task.description}</p>}
   {task.latest_note&&<p className={s.taskMeta}>{t('currentTask')}: {task.latest_note}</p>}
   {task.status!=='done'&&task.status!=='cancelled'&&<details className={s.taskDetails}><summary>{t('progress')}</summary><Progress task={task} language={language}/></details>}
  </article>)}
  {!list.length&&<p className={s.note}>{t('noTasks')}</p>}</div>
  <p className={s.taskDisclaimer}>{t('note')}</p>
 </section>;
}
