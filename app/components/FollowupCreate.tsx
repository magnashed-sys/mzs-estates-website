'use client';
import {useActionState,useState} from 'react';
import Link from 'next/link';
import {createFollowups} from '../followup-actions';
import {completenessLabels,type CompletenessItem} from '../../lib/accountancy/completeness';
import type {Assignee,FollowupResult} from '../../lib/accountancy/followups';
import {followupText,type FollowupLanguage} from '../../lib/accountancy/followup-copy';
import s from '../admin/workspaces/accountancy/administrations/administration.module.css';
export default function FollowupCreate({items,year,people,existing,language}:{items:CompletenessItem[];year:string;people:Assignee[];existing:string[];language:FollowupLanguage}){
 const t=(key:string)=>followupText(language,key);
 const [selected,setSelected]=useState<string[]>([]),[assignee,setAssignee]=useState(''),[due,setDue]=useState(''),[preview,setPreview]=useState(false);
 const [result,action,pending]=useActionState(async (state:FollowupResult,form:FormData)=>{const next=await createFollowups(state,form);if(next.status==='success'){setSelected([]);setPreview(false);}return next;},{status:'idle',message:''} as FollowupResult);
 const available=items.filter(i=>!existing.includes(i.id));const chosen=items.filter(i=>selected.includes(i.id)&&!existing.includes(i.id));
 const locked=pending;
 return <section aria-label={t('select')}>
 <p>{t('scope')}</p>
 <div className={s.tableWrap}><table className={s.table}><thead><tr><th>{t('select')}</th><th>{language==='es'?'Registro':'Record'}</th><th>{language==='es'?'Control':'Check'}</th><th>{t('source')}</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td>{existing.includes(i.id)?t('existing'):<input type="checkbox" aria-label={i.label} checked={selected.includes(i.id)} disabled={locked||preview} onChange={e=>setSelected(v=>e.target.checked?[...v,i.id]:v.filter(id=>id!==i.id))}/>}</td><td>{i.label}</td><td>{i.issues.map(code=><div key={code}>{completenessLabels[code]?.[language==='es'?1:0]??code}</div>)}</td><td><Link href={i.href}>{t('source')} →</Link></td></tr>)}</tbody></table></div>
 {available.length>0&&!locked&&<><button className={s.button} type="button" disabled={preview} onClick={()=>setSelected(available.map(i=>i.id))}>{t('selectAll')}</button>{' '}<button className={s.button} type="button" disabled={preview} onClick={()=>setSelected([])}>{t('clear')}</button></>}
 <form action={action} className={s.filters}>
 <input type="hidden" name="year_id" value={year}/>{chosen.map(i=><input key={i.id} type="hidden" name="item_key" value={i.id}/>)}
 <input type="hidden" name="assigned_profile_id" value={assignee}/><input type="hidden" name="due_on" value={due}/>
 {!preview?<><label>{t('assigned')}<select value={assignee} disabled={locked} onChange={e=>setAssignee(e.target.value)}><option value="">{t('unassigned')}</option>{people.map(p=><option key={p.id} value={p.id}>{p.full_name||p.id}</option>)}</select></label><label>{t('due')}<input type="date" min="2000-01-01" max="2099-12-31" value={due} disabled={locked} onChange={e=>setDue(e.target.value)}/></label><button className={s.button} type="button" disabled={!chosen.length||locked} onClick={()=>setPreview(true)}>{t('preview')} ({chosen.length})</button></>:<div><h3>{t('preview')} · {chosen.length}</h3><p>{t('assigned')}: {people.find(p=>p.id===assignee)?.full_name||t('unassigned')} · {t('due')}: {due||'—'}</p><ul>{chosen.map(i=><li key={i.id}>{i.label}</li>)}</ul><button className={s.button} type="button" disabled={locked} onClick={()=>setPreview(false)}>{t('back')}</button>{' '}<button className={s.button} type="submit" disabled={locked||!chosen.length}>{pending?t('saving'):t('save')}</button></div>}
 </form>
 {result.message&&<p role={result.status==='error'?'alert':'status'}>{t(result.message)} {result.count!==undefined?result.count:''}</p>}
 </section>;
}
