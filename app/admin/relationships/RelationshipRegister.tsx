'use client';
import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {saveRelationship} from './actions';
import {normalizedEmail, relationshipRoles, unextendedMembers, type RelationshipRecord, type RelationshipMember} from '../../../lib/relationships/model';
import s from '../group/estates/contracts/contracts.module.css';

type Draft = Omit<RelationshipRecord, 'id' | 'version'>;
type Props = {relationships: RelationshipRecord[]; members?: RelationshipMember[]; initialKind?: 'person' | 'company'; createInitially?: boolean; initialEdit?: string; initialProfile?: string; initialFilter?: 'all' | 'company'};
function newDraft(kind: 'person' | 'company', member?: RelationshipMember): Draft {
  return {kind, name: member?.full_name || member?.email || '', email: member?.email || '', address:'', phone:'', reference:'', roles:member?.role==='partner'?['client','partner']:['client'], profile_id:member?.id || null};
}
const roleLabels: Record<string,string> = {client:'Client', tenant:'Tenant', owner:'Owner', investor:'Investor', partner:'Partner'};

export default function RelationshipRegister({relationships, members = [], initialKind = 'person', createInitially = false, initialEdit, initialProfile, initialFilter = 'all'}: Props) {
  const router = useRouter();
  const initialRecord = relationships.find(r => r.id === initialEdit || (r.kind === 'person' && r.profile_id === initialProfile));
  const initialMember = members.find(m => m.id === initialProfile);
  const [editing, setEditing] = useState<RelationshipRecord | null | undefined>(initialRecord || (createInitially || initialMember ? null : undefined));
  const [draft, setDraft] = useState<Draft>(initialRecord || newDraft(initialKind, initialMember));
  const [filter, setFilter] = useState<'all' | 'person' | 'company'>(initialFilter);
  const [search, setSearch] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [existingId, setExistingId] = useState<string>();
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(initialRecord?.id || null);
  function change(key: keyof Draft, value: Draft[keyof Draft]) {setDraft(previous => ({...previous, [key]:value}));}
  function open(record: RelationshipRecord | null, kind: 'person' | 'company' = 'person', member?: RelationshipMember) {
    setEditing(record); setDraft(record || newDraft(kind, member)); setError(''); setExistingId(undefined); setNotice(''); setSelected(record?.id || null);
  }
  const matchedAccount = !draft.profile_id && draft.email ? members.find(m => normalizedEmail(m.email) === normalizedEmail(draft.email)) : undefined;
  const match = (values: string[]) => values.join(' ').toLowerCase().includes(search.trim().toLowerCase());
  const visible = relationships.filter(r => (filter === 'all' || r.kind === filter) && match([r.name,r.email,r.reference,r.address]));
  const existingAccounts = unextendedMembers(relationships, members).filter(m => filter !== 'company' && match([m.full_name || '',m.email]));
  const accountLabel = (id?: string | null) => {const m = members.find(m => m.id === id);return m ? `${m.full_name || m.email} · ${m.is_active === false ? 'Inactive' : 'Existing login'}` : 'No linked login';};
  return <>
    <p className={s.status}>Use one person record per client and link companies to the same contact account. Roles describe the relationship; login access and project permissions remain controlled separately.</p>
    <div className={s.toolbar}>
      <button className={s.button} disabled={pending} onClick={() => open(null,'person')}>New client</button>
      <button className={s.secondary} disabled={pending} onClick={() => open(null,'company')}>New company</button>
    </div>
    {error && <p role="alert" className={s.error}>{error}{existingId && <> <button type="button" onClick={() => {const r=relationships.find(r=>r.id===existingId);if(r)open(r);else router.refresh();}}>Open existing relationship</button></>}</p>}
    {notice && <p role="status" className={s.notice}>{notice}</p>}
    {editing !== undefined && <form className={s.panel} onSubmit={event => {
      event.preventDefault(); if(pending)return;setError('');setExistingId(undefined);
      start(async () => {
        try {
          const result = await saveRelationship({...draft}, editing?.id, editing?.version);
          if(result.error){setError(result.error);setExistingId(result.existingId);return;}
          setSelected(result.id || null);setEditing(undefined);setNotice('Relationship saved. Reuse this record for contracts and other roles.');router.refresh();
        } catch {setError('Saving could not be confirmed. Refresh the register before trying again.');}
      });
    }}>
      <h2>{editing ? 'Edit relationship' : draft.profile_id ? 'Extend existing relationship' : draft.kind === 'company' ? 'New company' : 'New client'}</h2>
      <fieldset disabled={pending}><div className={s.grid}>
        <label className={s.field}><span>{draft.kind === 'company' ? 'Legal company name' : 'Full name'}</span><input required minLength={2} maxLength={200} value={draft.name} onChange={e=>change('name',e.target.value)}/></label>
        <label className={s.field}><span>Relationship type</span><select value={draft.kind} onChange={e=>change('kind',e.target.value)}><option value="person">Person</option><option value="company">Company</option></select></label>
        <label className={s.field}><span>Email (optional)</span><input type="email" maxLength={254} value={draft.email} onChange={e=>change('email',e.target.value)}/></label>
        <label className={s.field}><span>Phone (optional)</span><input type="tel" maxLength={100} value={draft.phone} onChange={e=>change('phone',e.target.value)}/></label>
        <label className={s.field}><span>Billing address (optional)</span><textarea maxLength={1000} value={draft.address} onChange={e=>change('address',e.target.value)}/></label>
        <label className={s.field}><span>Reference (optional)</span><input maxLength={200} value={draft.reference} onChange={e=>change('reference',e.target.value)}/></label>
        <label className={s.field}><span>{draft.kind === 'company' ? 'Contact account (optional)' : 'Existing client account (optional)'}</span><select value={draft.profile_id || ''} onChange={e=>{
          const m=members.find(m=>m.id===e.target.value);
          setDraft(previous=>({...previous,profile_id:m?.id || null,name:previous.name || m?.full_name || m?.email || '',email:previous.email || m?.email || ''}));
        }}><option value="">No linked login</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name || m.email} · {m.email}{m.is_active===false?' · Inactive':''}</option>)}</select></label>
        <div><span className={s.label}>RELATIONSHIP ROLES</span>{relationshipRoles.map(role=><label key={role} className={s.check}><input type="checkbox" checked={(draft.roles || []).includes(role)} onChange={e=>change('roles',e.target.checked?[...(draft.roles || []),role]:(draft.roles || []).filter(r=>r!==role))}/>{roleLabels[role]}</label>)}</div>
      </div>
      {matchedAccount && <p className={s.notice}>An existing account uses this email: {matchedAccount.full_name || matchedAccount.email}. <button className={s.secondary} type="button" onClick={()=>{
        const record=relationships.find(r=>r.kind==='person' && r.profile_id===matchedAccount.id);
        if(draft.kind==='person' && record && record.id!==editing?.id)open(record);else change('profile_id',matchedAccount.id);
      }}>Use existing account</button></p>}
      <p className={s.help}>Saving a relationship does not create another login or send an invitation. Link an existing account to show its companies and activated contracts. Contracts with an account already recorded keep that account. Saved contracts and invoices are not rewritten.</p>
      <div className={s.toolbar}><button className={s.button} type="submit">{pending?'Saving…':'Save relationship'}</button><button className={s.secondary} type="button" onClick={()=>setEditing(undefined)}>Cancel</button></div>
      </fieldset>
    </form>}
    <div className={s.grid}>
      <label className={s.field}><span>Search relationships</span><input type="search" value={search} disabled={pending} onChange={e=>setSearch(e.target.value)}/></label>
      <label className={s.field}><span>Show</span><select value={filter} disabled={pending} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">People &amp; companies</option><option value="person">People</option><option value="company">Companies</option></select></label>
    </div>
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Name</th><th>Roles</th><th>Email</th><th>Account / dossier</th></tr></thead><tbody>
      {visible.map(r=><tr key={r.id} aria-selected={selected===r.id}><td><button disabled={pending} onClick={()=>open(r)}>{r.name}</button><small>{r.kind==='company'?'Company':'Person'}{r.reference?` · ${r.reference}`:''}</small></td><td>{(r.roles || []).map(role=>roleLabels[role] || role).join(', ')}</td><td>{r.email || '—'}</td><td>{accountLabel(r.profile_id)}{r.profile_id&&<small><Link href={`/admin/relationships/${r.profile_id}`}>Open account dossier →</Link></small>}</td></tr>)}
      {existingAccounts.map(m=><tr key={m.id}><td><button disabled={pending} onClick={()=>open(null,'person',m)}>{m.full_name || m.email}</button><small>Person · existing account</small></td><td>{m.role==='partner'?'Partner':'Client'}</td><td>{m.email}</td><td><Link href={`/admin/relationships/${m.id}`}>Open relationship dossier →</Link><small>{m.is_active===false?'Inactive':'Active'} · Add roles and billing details to this relationship</small></td></tr>)}
    </tbody></table></div>
    {!visible.length && !existingAccounts.length && <p className={s.empty}>No relationships match this view. Add a client or company to begin.</p>}
  </>;
}
