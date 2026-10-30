'use client';
import {useActionState,useState} from 'react';
import Link from 'next/link';
import {updateFollowup} from '../followup-actions';
import {followupSource,type Followup,type Assignee,type FollowupResult} from '../../lib/accountancy/followups';
import {followupText,type FollowupLanguage} from '../../lib/accountancy/followup-copy';
import s from '../admin/workspaces/accountancy/administrations/administration.module.css';
function Task({task,admin,people,language,signal,today}:{task:Followup;admin:boolean;people:Assignee[];language:FollowupLanguage;signal?:boolean;today:string}){
 const t=(key:string)=>followupText(language,key),[result,action,pending]=useActionState(updateFollowup,{status:'idle',message:''} as FollowupResult);
 const editable=admin||!['done','cancelled'].includes(task.status);
 return <article className={s.notice} id={'task-'+task.id}><h3>{task.title}</h3><p>{t(task.status)} · {t('due')}: {task.due_on||'—'} {task.due_on&&task.due_on<today&&!['done','cancelled'].includes(task.status)?' · '+t('overdue'):''}{admin?' · '+(people.find(p=>p.id===task.assigned_profile_id)?.full_name||(task.assigned_profile_id?'—':t('unassigned'))):''}</p>
 {admin&&<p><Link href={followupSource(task)}>{t('source')} →</Link>{signal!==undefined&&' · '+(signal?(language==='es'?'El control sigue pendiente':'Source check still outstanding'):(language==='es'?'El control ya no aparece; verifique antes de cerrar':'Source check no longer appears; verify before closing'))}</p>}
 {task.note&&<p>{task.note}</p>}
 {editable&&<details><summary>{t('update')}</summary><form action={action} className={s.filters}>
 <input type="hidden" name="id" value={task.id}/><input type="hidden" name="revision" value={task.revision}/>
 {admin&&<><label>{t('assigned')}<select name="assigned_profile_id" defaultValue={task.assigned_profile_id||''} disabled={pending}><option value="">{t('unassigned')}</option>{task.assigned_profile_id&&!people.some(p=>p.id===task.assigned_profile_id)&&<option value={task.assigned_profile_id} disabled>{language==='es'?'Responsable no disponible':'Assignee unavailable'}</option>}{people.map(p=><option key={p.id} value={p.id}>{p.full_name||p.id}</option>)}</select></label><label>{t('due')}<input name="due_on" type="date" defaultValue={task.due_on||''} min="2000-01-01" max="2099-12-31" disabled={pending}/></label></>}
 <label>Status<select name="status" defaultValue={task.status==='open'&&!admin?'in_progress':task.status} disabled={pending}>{(admin?['open','in_progress','blocked','done','cancelled']:['in_progress','blocked','done']).map(status=><option key={status} value={status}>{t(status)}</option>)}</select></label>
 <label>{t('note')}<input name="note" minLength={3} maxLength={1500} required disabled={pending}/></label><button className={s.button} disabled={pending}>{pending?t('saving'):t('update')}</button>
 </form></details>}{result.message&&<p role={result.status==='error'?'alert':'status'}>{t(result.message)}</p>}</article>;
}
export default function FollowupTasks({tasks,people=[],admin=false,userId,language,today,signals}:{tasks:Followup[];people?:Assignee[];admin?:boolean;userId:string;language:FollowupLanguage;today:string;signals?:string[]}){
 const t=(key:string)=>followupText(language,key),[scope,setScope]=useState('active'),[mine,setMine]=useState(false),[page,setPage]=useState(1);
 const rows=tasks.filter(task=>(!mine||task.assigned_profile_id===userId)&&(scope==='all'||scope==='closed'&&['done','cancelled'].includes(task.status)||scope==='active'&&!['done','cancelled'].includes(task.status)||scope==='overdue'&&!['done','cancelled'].includes(task.status)&&!!task.due_on&&task.due_on<today));
 const pages=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,pages);
 return <section className={s.page}><h2>{t('title')} ({tasks.length})</h2><p>{t('scope')}</p><div className={s.filters}><label>{t('title')}<select value={scope} onChange={e=>{setScope(e.target.value);setPage(1);}}>{['active','overdue','closed','all'].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>{admin&&<label><input type="checkbox" checked={mine} onChange={e=>{setMine(e.target.checked);setPage(1);}}/>{t('mine')}</label>}</div>
 {!rows.length&&<p>{t('empty')}</p>}{rows.slice((current-1)*20,current*20).map(task=><Task key={task.id+':'+task.revision} task={task} admin={admin} people={people} language={language} today={today} signal={signals?signals.includes(task.item_key):undefined}/>)}
 {pages>1&&<nav aria-label={t('title')}><button className={s.button} disabled={current===1} onClick={()=>setPage(current-1)}>{t('previous')}</button> {current}/{pages} <button className={s.button} disabled={current===pages} onClick={()=>setPage(current+1)}>{t('next')}</button></nav>}
 </section>;
}
