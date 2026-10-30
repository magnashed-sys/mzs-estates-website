'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createMyPropertyTask,updateMyTaskProgress} from './task-actions';
import {addMyMaintenanceProgress} from './ticket-note-actions';
import type {Ticket} from '../../lib/property-operations/staff-work';
import {taskOverview,taskOrder,taskPriorityName,taskStatusName,type PropertyTask} from '../../lib/property-operations/property-tasks';
import s from './staff.module.css';
import {staffText,type StaffLanguage} from '../../lib/property-operations/staff-copy';
type Property={id:string;name:string;address:string};
type Unit={id:string;property_id:string;address:string};
type WorkArea={id:string;name:string};
type FollowUp={id:string;ticket_id:string;note_kind:string;note:string;created_at:string};
type Result={status:'idle'|'success'|'error'|'warning';message:string};
const initial:Result={status:'idle',message:''};
function Message({state}:{state:Result}){return state.message&&<p role="status" className={state.status==='error'?s.error:state.status==='warning'?s.noticeWarning:s.confirm}>{state.message}</p>;}
function Progress({task,language}:{task:PropertyTask;language:StaffLanguage}){
 const router=useRouter();
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [state,action,pending]=useActionState(updateMyTaskProgress,initial);
 useEffect(()=>{if(state.status==='success')router.refresh();},[state.status,router]);
 return <form className={s.taskProgressForm} action={action}>
  <input type="hidden" name="task_id" value={task.id}/>
  <label>{t('progress')}
   <select name="status" defaultValue={task.status==='open'?'in_progress':task.status==='done'?'done':task.status}>
    <option value="in_progress">{t('taskProgress')}</option><option value="blocked">{t('taskBlocked')}</option><option value="done">{t('taskDone')}</option>
   </select>
  </label>
  <label>{t('progressNote')} <textarea name="note" minLength={3} maxLength={1500} rows={2} required placeholder={t('progressExample')}/></label>
  <button type="submit" disabled={pending}>{pending?t('saving'):t('saveProgress')}</button>
  <Message state={state}/>
 </form>;
}
function TicketFollowUp({ticket,language}:{ticket:Ticket;language:StaffLanguage}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [state,action,pending]=useActionState(addMyMaintenanceProgress,initial);
 const router=useRouter();
 useEffect(()=>{if(state.status==='success')router.refresh();},[state.status,router]);
 return <form className={s.taskProgressForm} action={action}>
  <input type="hidden" name="ticket_id" value={ticket.id}/>
  <label>{t('maintenanceProgressType')}<select name="note_kind" defaultValue="progress">
   <option value="progress">{t('maintenanceProgressDoing')}</option>
   <option value="blocked">{t('maintenanceProgressBlocked')}</option>
   <option value="ready_for_review">{t('maintenanceProgressReady')}</option>
  </select></label>
  <label>{t('progressNote')}<textarea name="note" rows={2} required minLength={8} maxLength={1500}
   placeholder={t('progressExample')}/></label>
  <button type="submit" disabled={pending}>{pending?t('saving'):t('saveProgress')}</button>
  <Message state={state}/>
 </form>;
}
type EntryKind='task'|'maintenance';
function NewWorkItem({properties,units,areas,profileId,language}:{properties:Property[];units:Unit[];areas:WorkArea[];profileId:string;language:StaffLanguage}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [taskState,taskAction,taskPending]=useActionState(createMyPropertyTask,initial);
 const [photoProgress,setPhotoProgress]=useState('');
 const router=useRouter();
 useEffect(()=>{if(taskState.status==='success')router.refresh();},[taskState.status,router]);
 const [lastTicketId,setLastTicketId]=useState<string|null>(null);
 const [maintenanceState,setMaintenanceState]=useState<Result>(initial);
 const [maintenancePending,setMaintenancePending]=useState(false);
 async function submitMaintenance(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(maintenancePending)return;
  const form=event.currentTarget;
  const formData=new FormData(form);
  const files=formData.getAll('photos')
   .filter((item):item is File=>item instanceof File&&item.size>0);
  if(files.length>3||files.some(file=>
    file.size>4194304||!['image/jpeg','image/png','image/webp'].includes(file.type))){
   setMaintenanceState({status:'error',message:t('photoHint')});
   return;
  }
  formData.delete('photos');
  setMaintenancePending(true);setMaintenanceState(initial);setLastTicketId(null);setPhotoProgress('');
  try{
   const response=await fetch('/api/staff/report-with-photos',{
    method:'POST',body:formData,credentials:'same-origin'
   });
   const payload:unknown=await response.json();
   const message=payload&&typeof payload==='object'&&'message' in payload&&
    typeof payload.message==='string'?payload.message:'Maintenance report could not be saved.';
   const ticketId=payload&&typeof payload==='object'&&'ticketId' in payload&&
    typeof payload.ticketId==='string'&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.ticketId)
      ?payload.ticketId:null;
   if(!response.ok||!ticketId){
    setMaintenanceState({status:'error',message});return;
   }
   setLastTicketId(ticketId);
   let uploaded=0;
   for(const file of files){
    setPhotoProgress(t('photoProgress')+' '+(uploaded+1)+' / '+files.length);
    const upload=new FormData();
    upload.set('ticket_id',ticketId);
    upload.set('file',file);
    try{
     const photo=await fetch('/api/staff/maintenance-photo',{
      method:'POST',body:upload,credentials:'same-origin'
     });
     if(!photo.ok)break;
     uploaded+=1;
    }catch{break;}
   }
   setPhotoProgress('');
   setMaintenanceState({status:uploaded===files.length?'success':'warning',message:uploaded===files.length
    ?t('reportSaved')+(files.length?' '+uploaded+' '+t('photosUploaded'):'')
    :t('uploadPartial')+' ('+uploaded+' / '+files.length+')'});
   form.reset();router.refresh();
  }catch{
   setMaintenanceState({status:'error',message:'Could not confirm submission. Check the maintenance register before trying again.'});
  }finally{setMaintenancePending(false);setPhotoProgress('');}
 }
 const [kind,setKind]=useState<EntryKind>('task');
 const [location,setLocation]=useState(properties[0]?'property:'+properties[0].id:'');
 const isArea=location.startsWith('area:');
 const propertyId=isArea?'':location.startsWith('property:')?location.slice(9):'';
 const workAreaId=isArea?location.slice(5):'';
 const [unitId,setUnitId]=useState('');
 const isMaintenance=kind==='maintenance'&&!isArea;
 const result=isMaintenance?maintenanceState:taskState;
 const pending=isMaintenance?maintenancePending:taskPending;
 return <section id="work-create" className={s.taskCreate} aria-labelledby="work-create-title">
  <form key={kind} className={s.form} action={isMaintenance?undefined:taskAction} onSubmit={isMaintenance?submitMaintenance:undefined}>
   <h2 id="work-create-title">{t('createHeading')}</h2>
   
   <label>{t('addType')}
    <select value={kind} onChange={e=>setKind(e.target.value as EntryKind)}>
     <option value="task">{t('task')}</option>
     {!isArea&&<option value="maintenance">{t('maintenance')}</option>}
    </select>
   </label>
   <input type="hidden" name="property_id" value={propertyId}/>
   <input type="hidden" name="work_area_id" value={workAreaId}/>
   {!isMaintenance&&<>
    <input type="hidden" name="assigned_profile_id" value={profileId}/>
    <input type="hidden" name="source_reference" value=""/>
   </>}
   <fieldset className={s.taskLocations}>
    <legend>{t('property')}</legend>
    <div className={s.taskLocationGrid}>
     {properties.filter(p=>p.name.includes('IJmuiden')).map(p=>{
      const value='property:'+p.id;
      const name=p.name.includes('Andromedastraat')?'Andromedastraat IJmuiden':
       p.name.includes('Kennemerlaan')?'Kennemerlaan IJmuiden':p.name;
      return <label key={p.id} className={location===value?s.taskLocationActive:s.taskLocationChoice}>
       <input type="radio" name="location_selection" value={value}
        checked={location===value} onChange={()=>{
         setLocation(value);setUnitId('');
        }}/>
       <span><strong>{name}</strong><small>{units.filter(u=>u.property_id===p.id).length} units</small></span>
      </label>;
     })}
     {areas.map(area=>{
      const value='area:'+area.id;
      return <label key={area.id} className={location===value?s.taskLocationActive:s.taskLocationChoice}>
       <input type="radio" name="location_selection" value={value}
        checked={location===value} onChange={()=>{
         setLocation(value);setUnitId('');setKind('task');
        }}/>
       <span><strong>{area.name}</strong><small>{t('workArea')}</small></span>
      </label>;
     })}
    </div>
   </fieldset>
   {(isArea||!units.some(u=>u.property_id===propertyId))&&<input type="hidden" name="unit_id" value=""/>}
   {!isArea&&units.some(u=>u.property_id===propertyId)&&<label>{t('unit')}
    <select name="unit_id" value={unitId} onChange={e=>setUnitId(e.target.value)}>
     <option value="">{t('whole')}</option>
     {units.filter(u=>u.property_id===propertyId).map(u=><option key={u.id} value={u.id}>{u.address}</option>)}
    </select>
   </label>}
   <label>{t(isMaintenance?'issueTitle':'taskTitle')}
    <input name="title" minLength={5} maxLength={140} required placeholder={t(isMaintenance?'issueExample':'taskExample')}/>
   </label>
   <label>{t(isMaintenance?'description':'details')}
    <textarea name="description" rows={3} minLength={isMaintenance?8:undefined}
     maxLength={2000} required={isMaintenance}
     placeholder={t(isMaintenance?'issueDetailsExample':'taskDetailsExample')}/>
   </label>
   <label>{t(isMaintenance?'urgency':'priority')}
    <select key={kind} name="priority" defaultValue={isMaintenance?'routine':'normal'}>
     {isMaintenance?<>
      <option value="routine">{t('normal')}</option>
      <option value="soon">{t('soon')}</option>
      <option value="urgent">{t('urgent')}</option>
     </>:<>
      <option value="normal">{t('normal')}</option>
      <option value="high">{t('high')}</option>
      <option value="urgent">{t('urgent')}</option>
      <option value="low">{t('low')}</option>
     </>}
    </select>
   </label>
   {!isMaintenance&&<details className={s.taskOptional}>
    <summary>{t('planning')}</summary>
    <label>{t('dueDate')} <input name="due_on" type="date"/></label>
   </details>}
   {isMaintenance&&<>
    <label>{t('photos')}
     <input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp"/>
    </label>
    <p className={s.description}>{t('photoHint')}</p>
    <p className={s.description}>{t('photoWarning')}</p>
   </>}
   <button disabled={pending||(!propertyId&&!workAreaId)} type="submit">{pending?t('saving'):t(isMaintenance?'sendReport':'createTask')}</button>
   <Message state={result}/>
   {isMaintenance&&photoProgress&&<p role="status" className={s.taskMeta}>{photoProgress}</p>}
   {isMaintenance&&lastTicketId&&<a className={s.taskSecondary}
     href={'/staff?ticket='+encodeURIComponent(lastTicketId)+'#ticket'}>{t('viewReport')}</a>}
  </form>
 </section>;
}
export default function StaffTaskBoard({tasks,tickets,followups,properties,units,areas,profileId,today,language}:{
 tasks:PropertyTask[];tickets:Ticket[];followups:FollowUp[];properties:Property[];units:Unit[];areas:WorkArea[];profileId:string;today:string;language:StaffLanguage;
}){
 const t=(key:Parameters<typeof staffText>[1])=>staffText(language,key);
 const [filter,setFilter]=useState<'open'|'high'|'all'>('open');
 const [showNew,setShowNew]=useState(false);
 const summary=taskOverview(tasks,today);
 const list=taskOrder(tasks).filter(task=>
  filter==='all'||(filter==='open'?!['done','cancelled'].includes(task.status):
    !['done','cancelled'].includes(task.status)&&['high','urgent'].includes(task.priority)));
 const maintenance=tickets.filter(ticket=>
  filter==='all'||(ticket.status!=='closed'&&ticket.status!=='resolved'&&
    (filter!=='high'||ticket.priority==='urgent')));
 const prop=new Map(properties.map(p=>[p.id,p.name]));
 const areaName=new Map(areas.map(area=>[area.id,area.name]));
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
  {showNew&&<NewWorkItem properties={properties} units={units} areas={areas} profileId={profileId} language={language}/>} 
  <div className={s.taskTabs} role="group" aria-label="Task status filter">
   <button type="button" className={filter==='open'?s.taskTabActive:s.taskTab} onClick={()=>setFilter('open')}>{t('taskOpen')} ({summary.open})</button>
   <button type="button" className={filter==='high'?s.taskTabActive:s.taskTab} onClick={()=>setFilter('high')}>{t('priorityHigh')} ({summary.urgent})</button>
   <button type="button" className={filter==='all'?s.taskTabActive:s.taskTab} onClick={()=>setFilter('all')}>{t('allTasks')}</button>
  </div>
  <div className={s.taskCardList}>{list.map(task=><article className={s.taskCard} key={task.id}>
   <div className={s.taskCardTop}><strong>{task.title}</strong><span className={s.taskChip}>{t(task.status==='open'?'taskOpen':task.status==='in_progress'?'taskProgress':task.status==='blocked'?'taskBlocked':task.status==='done'?'taskDone':'taskCancelled')}</span></div>
   <p className={s.taskMeta}>{task.work_area_id?areaName.get(task.work_area_id)??'Work area':prop.get(task.property_id??'')??'Property'}{task.unit_id?' · '+(unit.get(task.unit_id)??'Unit'):''}</p>
   <p className={s.taskMeta}>{taskPriorityName[task.priority]}{task.due_on?' · '+t('dueShort')+' '+task.due_on:''}</p>
   {task.description&&<p>{task.description}</p>}
   {task.latest_note&&<p className={s.taskMeta}>{t('currentTask')}: {task.latest_note}</p>}
   <a className={s.taskInlineLink} href={'/staff?task='+encodeURIComponent(task.id)+'#hours'}>{t('logTimeForTask')}</a>
   {task.status!=='done'&&task.status!=='cancelled'&&<details className={s.taskDetails}><summary>{t('progress')}</summary><Progress task={task} language={language}/></details>}
  </article>)}
  {!list.length&&!maintenance.length&&<p className={s.note}>{filter==='high'?t('noHighPriority'):t('noTasks')}</p>}</div>
  {maintenance.length>0&&<div className={s.maintenanceInTasks} aria-label={t('maintenanceFollowUpTitle')}>
   <h3>{t('maintenanceFollowUpTitle')}</h3>
   <div className={s.taskCardList}>
    {maintenance.map(ticket=>{
     const latest=followups.find(n=>n.ticket_id===ticket.id);
     return <article key={ticket.id} className={s.taskCard}>
      <div className={s.taskCardTop}><strong>{ticket.title}</strong>
       <span className={s.taskChip}>{t('maintenanceBadge')}</span></div>
      <p className={s.taskMeta}>{prop.get(ticket.property_id)??t('property')}</p>
      <p className={s.taskMeta}>{ticket.status.replaceAll('_',' ')} · {ticket.priority==='urgent'?t('urgent'):t('normal')}</p>
      <p>{ticket.description}</p>
      {latest&&<p className={s.taskMeta}>{t('currentTask')}: {latest.note}</p>}
      <a className={s.taskInlineLink} href={'/staff?ticket='+encodeURIComponent(ticket.id)+'#ticket'}>{t('viewReport')}</a>
      {ticket.status!=='closed'&&<details className={s.taskDetails}>
       <summary>{t('maintenanceFollowUpAction')}</summary>
       <TicketFollowUp key={ticket.id+'-'+(latest?.id??'')} ticket={ticket} language={language}/>
      </details>}
     </article>;
    })}
   </div>
  </div>}
  <p className={s.taskDisclaimer}>{t('note')}</p>
 </section>;
}
