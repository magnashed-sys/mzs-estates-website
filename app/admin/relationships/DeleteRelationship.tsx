'use client';
import {useEffect,useId,useRef,useState,useTransition} from 'react';
import {createPortal} from 'react-dom';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {getRelationshipDeletionPlan,deleteRelationship} from './actions';
import type {DeletionPlan} from '../../../lib/relationships/deletion';
import s from './deletion.module.css';

export default function DeleteRelationship({kind,id,disabled=false,onDeleted}:{kind:'account'|'relationship';id:string;disabled?:boolean;onDeleted?:()=>void}) {
 const router=useRouter();const heading=useId();const dialog=useRef<HTMLDialogElement>(null);
 const [plan,setPlan]=useState<DeletionPlan|null>(null);const [confirmation,setConfirmation]=useState('');const [error,setError]=useState('');const [pending,start]=useTransition();
 useEffect(()=>{if(plan&&!dialog.current?.open)dialog.current?.showModal();},[plan]);
 function check(){setError('');setConfirmation('');start(async()=>{try{const r=await getRelationshipDeletionPlan(kind,id);if(r.error)setError(r.error);else if(r.plan)setPlan(r.plan);}catch{setError('The deletion check could not be completed. No records were removed.');}});}
 return <>
  <button type="button" className={s.trigger} disabled={disabled||pending} onClick={check}>{pending&&!plan?'Checking…':kind==='account'?'Delete client account':'Delete relationship'}</button>
  {error&&!plan&&<p role="alert" className={s.error}>{error}</p>}
  {plan&&createPortal(<dialog ref={dialog} className={s.dialog} aria-labelledby={heading} onCancel={e=>{if(pending)e.preventDefault();}} onClose={()=>{setPlan(null);setError('');}}>
    <h2 id={heading}>{plan.kind==='account'?'Delete client account':'Delete relationship'}</h2><p><strong>{plan.name}</strong></p>
    {plan.blockers.length?<><p>This record cannot be deleted because it is linked to:</p><ul>{plan.blockers.map(reason=><li key={reason}>{reason}</li>)}</ul><p>Contract, invoice and other business history must be retained.{plan.kind==='account'&&<> You can deactivate the account in <Link href="/admin?tab=relationships">Relationships</Link>.</>}</p></>:<form onSubmit={e=>{e.preventDefault();if(pending||confirmation!==plan.confirmation)return;setError('');start(async()=>{try{const r=await deleteRelationship(plan.kind,plan.id,plan.revision,confirmation);if(r.error){setError(r.error);return;}setPlan(null);router.refresh();onDeleted?.();}catch{setError('Deletion could not be confirmed. Close this dialog and refresh the register before retrying.');}});}}>
      <p>{plan.kind==='account'?'This permanently removes the login, unused person record, contact details, declared companies, access rights and registration records. Sessions are revoked.':'This permanently removes only this relationship record. A linked contact account is kept.'}</p>
      {plan.kind==='account'&&<p>{plan.cleanup.person_records||0} person record(s) · {plan.cleanup.declared_companies||0} company declaration(s) · {(plan.cleanup.project_access||0)+(plan.cleanup.offering_access||0)} access assignment(s).</p>}
      <label>Type <strong>{plan.confirmation}</strong> to confirm<input autoFocus autoComplete="off" spellCheck={false} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={pending}/></label>
      {error&&<p role="alert" className={s.error}>{error}</p>}
      <button className={s.confirm} type="submit" disabled={pending||confirmation!==plan.confirmation}>{pending?'Deleting…':'Permanently delete'}</button>
    </form>}
    <button type="button" className={s.cancel} disabled={pending} onClick={()=>dialog.current?.close()}>{plan.blockers.length?'Close':'Cancel'}</button>
  </dialog>,document.body)}
 </>;
}
