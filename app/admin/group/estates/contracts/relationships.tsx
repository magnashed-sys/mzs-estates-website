'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {saveLeaseRelationship} from './actions';
import s from './contracts.module.css';
export type LeaseRelationship={id:string;version:number;name:string;kind:string;address:string;email:string;phone:string;reference:string;roles?:string[];profile_id?:string|null};
export default function LeaseRelationships({relationships,members=[]}:{relationships:LeaseRelationship[];members?:{id:string;full_name:string|null;email:string}[]}){
 const router=useRouter();const [editing,setEditing]=useState<LeaseRelationship|null|undefined>();const [search,setSearch]=useState('');const [pending,start]=useTransition();const [error,setError]=useState('');const [notice,setNotice]=useState('');
 return <>
  <p className={s.status}>One relationship record can be a tenant, owner, investor or partner. Reuse it across your rental administration. A rental relationship does not create a login, send an invitation or grant access.</p>
  <div className={s.toolbar}><button className={s.button} disabled={pending} onClick={()=>{setEditing(null);setError('');setNotice('')}}>New rental relationship</button></div>
  {error&&<p role="alert" className={s.error}>{error}</p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}
  {editing!==undefined&&<form key={editing?.id||'new'} className={s.panel} onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const data={...Object.fromEntries(fd.entries()),roles:fd.getAll('roles'),profile_id:fd.get('profile_id')||null};setError('');start(async()=>{try{const r=await saveLeaseRelationship(data,editing?.id,editing?.version);if(r.error)setError(r.error);else{setEditing(undefined);setNotice('Rental relationship saved. It is now available in the contract form.');router.refresh();}}catch{setError('Could not verify saving. Refresh before trying again.')}})}}>
   <h2>{editing?'Edit rental relationship':'New rental relationship'}</h2>
   <fieldset disabled={pending} style={{border:0,padding:0,margin:0}}><div className={s.grid}>
   <label className={s.field}><span>Legal name / person</span><input name="name" required minLength={2} maxLength={200} defaultValue={editing?.name}/></label>
   <label className={s.field}><span>Relationship type</span><select name="kind" defaultValue={editing?.kind||'company'}><option value="company">Company</option><option value="person">Person</option></select></label>
   <label className={s.field}><span>Billing address (optional)</span><textarea name="address" maxLength={1000} defaultValue={editing?.address}/></label>
   <label className={s.field}><span>Email (optional)</span><input name="email" type="email" maxLength={254} defaultValue={editing?.email}/></label>
   <label className={s.field}><span>Phone (optional)</span><input name="phone" type="tel" maxLength={100} defaultValue={editing?.phone}/></label>
   <label className={s.field}><span>Reference (optional)</span><input name="reference" maxLength={200} defaultValue={editing?.reference}/></label>
   <label className={s.field}>Linked platform account (optional)<select name="profile_id" onChange={e=>{const member=members.find(m=>m.id===e.target.value);if(member&&e.currentTarget.form){for(const [key,value] of [['name',member.full_name||member.email],['email',member.email]]){const input=e.currentTarget.form.elements.namedItem(key) as HTMLInputElement;if(!input.value.trim())input.value=value;}}}} defaultValue={editing?.profile_id||''}><option value="">No login account</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name||m.email}</option>)}</select></label><div>{['tenant','owner','investor','partner'].map(role=><label key={role} className={s.check}><input name="roles" type="checkbox" value={role} defaultChecked={(editing?.roles||['tenant']).includes(role)}/>{role}</label>)}</div>
   </div><div className={s.toolbar}><button className={s.button} type="submit">{pending?'Saving…':'Save rental relationship'}</button><button className={s.secondary} type="button" onClick={()=>setEditing(undefined)}>Cancel</button></div></fieldset>
  </form>}
  <label className={s.field}><span>Search rental relationships</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label>
  <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Name</th><th>Roles / account</th><th>Email</th><th>Reference</th></tr></thead><tbody>{relationships.filter(r=>(r.name+' '+r.email+' '+r.reference).toLowerCase().includes(search.toLowerCase())).map(r=><tr key={r.id}><td><button disabled={pending} onClick={()=>{setEditing(r);setError('');setNotice('')}}>{r.name}</button></td><td>{(r.roles||['tenant']).join(', ')}{r.profile_id&&<small><a href={`/admin/relationships/${r.profile_id}`}>Open account dossier →</a></small>}</td><td>{r.email||'—'}</td><td>{r.reference||'—'}</td></tr>)}</tbody></table></div>
  {!relationships.length&&<p className={s.empty}>No rental relationships yet. Only the name and type are required to start.</p>}
  <p className={s.help}>Editing a relationship does not rewrite saved contract or invoice details. Review and update the draft contract separately.</p>
 </>;
}
