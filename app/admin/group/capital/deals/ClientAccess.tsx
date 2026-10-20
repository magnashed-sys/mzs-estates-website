import {grantClientAccess,updateClientAccess,revokeClientAccess} from './actions';
import Submit from './ClientAccessSubmit';
import s from './deals.module.css';
export type ClientGrant={id:string;deal_id:string;user_id:string;party_role:'lender'|'borrower';display_label:string;is_active:boolean};
export type AccessRelationship={id:string;email:string;full_name:string|null;role:string;is_active:boolean};
export default function ClientAccess({dealId,grants,relationships,complete}:{dealId:string;grants:ClientGrant[];relationships:AccessRelationship[];complete:boolean}){
 if(!complete)return <section className={s.section}><h2>Client access</h2><p role="alert">The complete access list could not be loaded. Reload before changing access.</p></section>;
 const available=relationships.filter(p=>p.is_active&&!grants.some(g=>g.user_id===p.id));
 return <section className={s.section}>
  <h2>Client access</h2><p>New or reactivated access sends an email notification. Editing the name or role does not send another message.</p><p>Share a limited, read-only summary with a selected relationship. They see the loan amount, dates and confirmed interest from their own perspective. Internal notes, documents, bank references and administration history remain private.</p>
  {grants.length?grants.map(g=>{
   const p=relationships.find(p=>p.id===g.user_id);
   return <article className={s.card} key={g.id}>
    <h3>{p?.full_name||p?.email||'Unavailable relationship'}</h3><p>{p?.email}</p>
    <span className={s.badge}>{!g.is_active?'Access revoked':p?.is_active?'Access active':'Account inactive — access blocked'}</span>
    <form action={updateClientAccess} className={s.form}>
     <input type="hidden" name="deal_id" value={dealId}/><input type="hidden" name="grant_id" value={g.id}/>
     <input type="hidden" name="expected_active" value={String(g.is_active)}/><input type="hidden" name="expected_role" value={g.party_role}/><input type="hidden" name="expected_label" value={g.display_label}/>
     <label>Relationship's role<select name="party_role" defaultValue={g.party_role}><option value="lender">Lender — receives interest</option><option value="borrower">Borrower — pays interest</option></select></label>
     <label>Client-facing dossier name<input name="display_label" required minLength={2} maxLength={120} defaultValue={g.display_label}/></label>
     <label>Access<select name="is_active" defaultValue={String(g.is_active)}><option value="true" disabled={!p?.is_active}>Active</option><option value="false">Revoked</option></select></label>
     <label className={s.wide}><input type="checkbox" name="confirm_access" value="yes" required/> I have checked the recipient, role and information being shared.</label>
     <Submit>Save client access</Submit>
    </form>
    {g.is_active&&<form action={revokeClientAccess} className={s.inline}><input type="hidden" name="deal_id" value={dealId}/><input type="hidden" name="grant_id" value={g.id}/><Submit>Revoke access</Submit></form>}
   </article>;
  }):<p>No relationships have access to this dossier.</p>}
  <details><summary>Grant access to a relationship</summary>
   {available.length?<form action={grantClientAccess} className={s.form}>
    <input type="hidden" name="deal_id" value={dealId}/>
    <label className={s.wide}>Relationship<select name="user_id" required defaultValue=""><option value="" disabled>Select an active client or partner</option>{available.map(p=><option key={p.id} value={p.id}>{p.full_name||'Unnamed relationship'} — {p.email}</option>)}</select></label>
    <label>Relationship's role<select name="party_role" required defaultValue=""><option value="" disabled>Select the actual contract role</option><option value="lender">Lender — receives interest</option><option value="borrower">Borrower — pays interest</option></select></label>
    <label>Client-facing dossier name<input name="display_label" required minLength={2} maxLength={120} defaultValue="Private loan"/></label>
    <label className={s.wide}><input type="checkbox" name="confirm_access" value="yes" required/> I have checked that this relationship may see this dossier.</label>
    <p className={s.wide}>Access takes effect on the next load of their Private Capital overview. New or reactivated access queues an email to the selected relationship. Revoked relationships remain above and can be reactivated there.</p>
    <Submit>Grant client access</Submit>
   </form>:<p>No additional active clients or partners are available.</p>}
  </details>
 </section>;
}
