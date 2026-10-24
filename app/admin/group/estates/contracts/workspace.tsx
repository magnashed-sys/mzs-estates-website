'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/client';
import { euros } from '../../../../../lib/estates/rent';
import { invoiceMonthStart, leaseSubjectPreview } from '../../../../../lib/estates/lease-month';
import { saveContract, setContractStatus, generateDrafts, reviewInvoice, leaseDocuments } from './actions';
import s from './contracts.module.css';

type Property={id:string;name:string;owner_name:string;address:string};
type Unit={id:string;property_id:string;address:string;tenant_name:string|null;monthly_rent:number;utilities_advance:number|null;rent_included:boolean};
type Member={id:string;full_name:string|null;email:string};
type Line={description:string;amount:string;vat:string};
type Contract={id:string;version:number;status:string;title:string;property_id:string;unit_ids:string[];tenant_profile_id:string|null;tenant_name:string;tenant_address:string;tenant_email:string;issuer_name:string;issuer_address:string;issuer_iban:string;issuer_tax_id:string;contract_date:string;lease_start:string;lease_end:string|null;first_period:string;first_generation_date:string;max_terms:number|null;payment_days:number;payment_conditions:string;customer_reference:string;invoice_subject:string;invoice_language:string;planning_color:string;deposit:number;prorate:boolean;lines:Line[];notes:string};
type Invoice={id:string;contract_id:string;period_start:string;period_end:string;scheduled_date:string;due_date:string;subject:string;snapshot:Contract&{unit_addresses:string;covered_from:string;covered_to:string};lines:(Line&{net:number;tax:number;total:number})[];subtotal:number;tax_total:number;total:number;review_status:string;review_note:string};
type Props={properties:Property[];units:Unit[];members:Member[];contracts:Contract[];invoices:Invoice[]};
const date=(v:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={`${s.field} ${wide?s.wide:''}`}><span>{label}</span>{children}</label>}

export default function ContractWorkspace({properties,units,members,contracts,invoices}:Props){
 const router=useRouter();const [pending,startTransition]=useTransition();
 const [tab,setTab]=useState<'contracts'|'invoices'>('contracts');
 const [editing,setEditing]=useState<Contract|null|undefined>(undefined);
 const [selected,setSelected]=useState<string|null>(null);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState('');const [propertyFilter,setPropertyFilter]=useState('');
 const [invoiceId,setInvoiceId]=useState<string|null>(null);
 const selectedContract=contracts.find(c=>c.id===selected);
 const invoice=invoices.find(i=>i.id===invoiceId);
 function run(action:()=>Promise<{error?:string;message?:string}>) {setError('');setNotice('');startTransition(async()=>{try{const r=await action();if(r.error)setError(r.error);else{setNotice(r.message || 'Saved.');router.refresh();}}catch{setError('The action could not be verified. Refresh the page before trying again.');}});}
 const shown=contracts.filter(c=>(!propertyFilter||c.property_id===propertyFilter)&&(!filter||`${c.title} ${c.tenant_name}`.toLowerCase().includes(filter.toLowerCase())));
 return <>
  <div className={s.notice}>Staging · Monthly concept invoices only. No final invoice numbers or emails are issued here.</div>
  <div className={s.metrics}><div><span className={s.label}>CONTRACTS</span><strong>{contracts.length}</strong></div><div><span className={s.label}>ACTIVE SCHEDULES</span><strong>{contracts.filter(c=>c.status==='active').length}</strong></div><div><span className={s.label}>DRAFTS TO REVIEW</span><strong>{invoices.filter(i=>i.review_status==='pending').length}</strong></div></div>
  <div className={s.tabs}><button className={s.secondary} aria-pressed={tab==='contracts'} onClick={()=>setTab('contracts')}>Contracts</button><button className={s.secondary} aria-pressed={tab==='invoices'} onClick={()=>setTab('invoices')}>Invoice drafts</button></div>
  {error&&<p role="alert" className={s.error}>{error}</p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}
  {tab==='contracts'?<>
   <div className={s.toolbar}><button className={s.button} onClick={()=>{setEditing(null);setSelected(null);setError('');setNotice('')}}>New contract</button></div>
   {editing!==undefined&&<ContractForm key={editing?.id || 'new'} contract={editing} properties={properties} units={units} members={members} pending={pending} onCancel={()=>setEditing(undefined)} onSave={payload=>run(async()=>{const r=await saveContract(payload,editing?.id,editing?.version);if(r.error)return r;setEditing(undefined);setSelected(r.id || null);return {message:'Contract saved as a draft. Review the agreement before activating monthly billing.'};})}/>}
   <div className={s.grid}><Field label="Search contracts"><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Contract or tenant"/></Field><Field label="Property"><select value={propertyFilter} onChange={e=>setPropertyFilter(e.target.value)}><option value="">All properties</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
   {shown.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Contract / tenant</th><th>First invoice period</th><th>Monthly net amount</th><th>Status</th></tr></thead><tbody>{shown.map(c=><tr key={c.id}><td><button onClick={()=>{setSelected(c.id);setEditing(undefined)}}>{c.title}</button><small>{c.tenant_name}</small></td><td>{date(c.first_period)}</td><td>{euros(c.lines.reduce((sum,l)=>sum+Math.round(Number(l.amount)*100),0)/100)}</td><td><span className={s.badge}>{c.status}</span></td></tr>)}</tbody></table></div>:<p className={s.empty}>No contracts match this view. Start with a draft and link the units covered by the agreement.</p>}
   {selectedContract&&<section className={s.panel}><h2>{selectedContract.title}</h2><div className={s.details}><div><span className={s.label}>TENANT</span><p>{selectedContract.tenant_name}<br/>{selectedContract.tenant_address}<br/>{selectedContract.tenant_email}</p></div><div><span className={s.label}>ISSUER</span><p>{selectedContract.issuer_name}<br/>{selectedContract.issuer_address}<br/>{selectedContract.issuer_iban}</p></div></div>
    <p className={s.status}>{units.filter(u=>selectedContract.unit_ids.includes(u.id)).map(u=>u.address).join(' · ')}</p>
    <p className={s.status}>Lease: {date(selectedContract.lease_start)} — {selectedContract.lease_end?date(selectedContract.lease_end):'open-ended'}<br/>First invoice period: {date(selectedContract.first_period)} · First preparation: {date(selectedContract.first_generation_date)}<br/>Monthly · {selectedContract.max_terms?`${selectedContract.max_terms} periods maximum`:'until stopped or lease end'} · Payment within {selectedContract.payment_days} days of scheduled invoice date<br/>Partial months: {selectedContract.prorate?'calendar-day proration':'full monthly amount'} · Deposit: {euros(selectedContract.deposit)} (not recurring)</p>
    <p className={s.preview}>{selectedContract.invoice_subject}</p>
    <div className={s.toolbar}>{selectedContract.status==='draft'?<><button className={s.secondary} disabled={pending} onClick={()=>setEditing(selectedContract)}>Edit draft</button><button className={s.button} disabled={pending} onClick={()=>{if(window.confirm('Activate monthly draft preparation for this Staging contract? Check the first invoice period and confirm that the amounts and units are correct. Activated terms are locked.'))run(async()=>{const r=await setContractStatus(selectedContract.id,selectedContract.version,'active');return {...r,message:'Monthly draft preparation activated. Due periods will be included in the next daily run.'};});}}>Activate schedule</button></>:selectedContract.status==='active'?<button className={s.secondary} disabled={pending} onClick={()=>{if(window.confirm('Stop future draft preparation? Existing drafts remain available. This does not terminate the legal rental agreement.'))run(async()=>{const r=await setContractStatus(selectedContract.id,selectedContract.version,'stopped');return {...r,message:'Draft preparation stopped. Existing documents are retained.'};});}}>Stop billing schedule</button>:null}</div>
    {selectedContract.status!=='draft'&&<p className={s.help}>Activated terms are retained for the audit history. For changed terms, stop this billing schedule and create a replacement draft starting with the agreed next invoice month. Review the existing drafts before activating the replacement.</p>}
    <Documents key={selectedContract.id} contractId={selectedContract.id}/>
   </section>}
  </>:<>
   <p className={s.status}>The daily run prepares due periods for active contracts. Re-running it catches up missing periods without creating duplicates. The latest 500 drafts are shown.</p>
   <div className={s.toolbar}><button className={s.button} disabled={pending} onClick={()=>run(async()=>{const r=await generateDrafts();return {...r,message:`${r.count || 0} new invoice draft(s) prepared. Existing drafts were kept.`};})}>Prepare due drafts now</button></div>
   {invoices.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Invoice subject / tenant</th><th>Period</th><th>Issuer</th><th>Total</th><th>Review</th></tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td><button onClick={()=>setInvoiceId(i.id)}>{i.subject}</button><small>{i.snapshot.tenant_name}</small></td><td>{date(i.period_start)}</td><td>{i.snapshot.issuer_name}</td><td className={s.money}>{euros(i.total)}</td><td><span className={s.badge}>{i.review_status}</span></td></tr>)}</tbody></table></div>:<p className={s.empty}>No invoice drafts yet. Activate a reviewed contract and prepare its due periods.</p>}
   {invoice&&<InvoiceReview key={invoice.id} invoice={invoice} pending={pending} onReview={(checked,note)=>run(async()=>{const r=await reviewInvoice(invoice.id,checked,note);return {...r,message:'Review saved. This document remains a concept invoice.'};})}/>}
  </>}
 </>;
}

function ContractForm({contract,properties,units,members,pending,onSave,onCancel}:{contract:Contract|null;properties:Property[];units:Unit[];members:Member[];pending:boolean;onSave:(data:Record<string,unknown>)=>void;onCancel:()=>void}){
 const [property,setProperty]=useState(contract?.property_id || '');const [chosen,setChosen]=useState<string[]>(contract?.unit_ids || []);
 const [tenant,setTenant]=useState(contract?.tenant_name || '');const [email,setEmail]=useState(contract?.tenant_email || '');const [issuer,setIssuer]=useState(contract?.issuer_name || '');
 const [lines,setLines]=useState<Line[]>(contract?.lines || [{description:'Huur',amount:'',vat:'exempt'}]);
 const [subject,setSubject]=useState(contract?.invoice_subject || 'Huur {unitadres} — {maand} {jaar}');
 const [language,setLanguage]=useState(contract?.invoice_language || 'nl');const [period,setPeriod]=useState(contract?.first_period?.slice(0,7)||'');
 const selectedUnits=units.filter(u=>chosen.includes(u.id));
 const example=leaseSubjectPreview(subject,period,language,selectedUnits.map(u=>u.address).sort().join(', '));
 function field(name:keyof Contract){return contract?.[name] as string | undefined;}
 function suggestAmounts(){setLines([{description:'Huur',amount:(selectedUnits.reduce((sum,u)=>sum+Math.round(Number(u.monthly_rent)*100),0)/100).toFixed(2),vat:'exempt'}, {description:'Voorschot nutsvoorzieningen',amount:selectedUnits.every(u=>u.utilities_advance!==null)?(selectedUnits.reduce((sum,u)=>sum+Math.round(Number(u.utilities_advance)*100),0)/100).toFixed(2):'',vat:''}]);if(!tenant)setTenant(selectedUnits[0]?.tenant_name||'');}
 return <form onSubmit={e=>{e.preventDefault();const firstPeriod=invoiceMonthStart(period);if(!firstPeriod){const input=e.currentTarget.elements.namedItem('first_invoice_month') as HTMLInputElement;input.setCustomValidity('Enter a complete month as YYYY-MM, for example 2026-11.');input.reportValidity();return;}const fd=new FormData(e.currentTarget);onSave({...Object.fromEntries(fd.entries()),property_id:property,unit_ids:chosen,tenant_profile_id:fd.get('tenant_profile_id')||null,tenant_name:tenant,tenant_email:email,issuer_name:issuer,lease_end:fd.get('lease_end')||null,first_period:firstPeriod,max_terms:fd.get('max_terms')?Number(fd.get('max_terms')):null,payment_days:Number(fd.get('payment_days')),deposit:Number(fd.get('deposit')||0),prorate:fd.has('prorate'),lines,invoice_subject:subject,invoice_language:language});}}>
  <fieldset disabled={pending} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <section className={s.panel}><h2>{contract?'Edit contract draft':'New rental contract'}</h2><div className={s.grid}>
   <Field label="Contract subject"><input name="title" required maxLength={200} defaultValue={field('title')}/></Field>
   <Field label="Contract date"><input name="contract_date" type="date" required defaultValue={field('contract_date') || today()}/></Field>
   <Field label="Property" wide><select required value={property} onChange={e=>{setProperty(e.target.value);setChosen([]);setIssuer(properties.find(p=>p.id===e.target.value)?.owner_name||'');}}><option value="">Select property</option>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>
   <div className={s.wide}><p className={s.label}>UNITS COVERED BY THIS CONTRACT</p><div className={s.checks}>{units.filter(u=>u.property_id===property).map(u=><label key={u.id} className={s.check}><input type="checkbox" checked={chosen.includes(u.id)} onChange={e=>setChosen(prev=>e.target.checked?[...prev,u.id]:prev.filter(id=>id!==u.id))}/><span>{u.address}<br/><small className={s.help}>{u.rent_included?'Rent included in another unit':`${euros(u.monthly_rent)} recorded monthly rent`}</small></span></label>)}</div></div>
   <Field label="Link existing relationship (optional)"><select name="tenant_profile_id" defaultValue={contract?.tenant_profile_id||''} onChange={e=>{const m=members.find(x=>x.id===e.target.value);if(m){setTenant(m.full_name||m.email);setEmail(m.email)}}}><option value="">Tenant without linked account</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name||m.email}</option>)}</select></Field>
   <Field label="Tenant / legal company name"><input required maxLength={200} value={tenant} onChange={e=>setTenant(e.target.value)}/></Field>
   <Field label="Tenant billing address"><textarea name="tenant_address" required maxLength={1000} rows={3} defaultValue={field('tenant_address')}/></Field>
   <Field label="Tenant email"><input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></Field>
   <Field label="Landlord / issuing legal entity"><input required maxLength={200} value={issuer} onChange={e=>setIssuer(e.target.value)}/></Field>
   <Field label="Issuer billing address"><textarea name="issuer_address" required maxLength={1000} rows={3} defaultValue={field('issuer_address')}/></Field>
   <Field label="Issuer IBAN"><input name="issuer_iban" required maxLength={40} defaultValue={field('issuer_iban')}/></Field>
   <Field label="Issuer tax identification (if applicable)"><input name="issuer_tax_id" maxLength={60} defaultValue={field('issuer_tax_id')}/></Field>
  </div></section>
  <section className={s.panel}><h2>Agreement &amp; monthly schedule</h2><div className={s.grid}>
   <Field label="Lease start"><input name="lease_start" type="date" required defaultValue={field('lease_start')}/></Field>
   <Field label="Lease end (optional)"><input name="lease_end" type="date" defaultValue={field('lease_end')||''}/></Field>
   <Field label="First invoice month in MZS"><input name="first_invoice_month" type="month" required min="0001-01" max="9999-12" pattern="[0-9]{4}-(0[1-9]|1[0-2])" placeholder="YYYY-MM" title="Enter the year and month, for example 2026-11." value={period} onChange={e=>{const input=e.currentTarget;input.setCustomValidity(input.value&&!invoiceMonthStart(input.value)?'Enter a complete month as YYYY-MM, for example 2026-11.':'');setPeriod(input.value);}}/></Field>
   <Field label="First draft preparation date"><input name="first_generation_date" type="date" required defaultValue={field('first_generation_date')}/></Field>
   <p className={`${s.help} ${s.wide}`}>Frequency: every month. Select the first month not already invoiced by your previous platform. The preparation date can fall in that month or the preceding month. A date of 31 repeats on the last day of shorter months.</p>
   <Field label="Maximum invoice periods (blank = ongoing)"><input name="max_terms" type="number" min={1} max={600} defaultValue={contract?.max_terms||''}/></Field>
   <Field label="Payment term — days after scheduled invoice date"><input name="payment_days" type="number" min={0} max={120} required defaultValue={contract?.payment_days??14}/></Field>
   <Field label="Payment method"><input value="Bank transfer" readOnly/></Field>
   <Field label="Customer reference"><input name="customer_reference" maxLength={200} defaultValue={field('customer_reference')}/></Field>
   <Field label="Payment conditions" wide><textarea name="payment_conditions" maxLength={1000} defaultValue={field('payment_conditions')}/></Field>
   <Field label="Planning colour"><input name="planning_color" type="color" defaultValue={field('planning_color')||'#c8b18a'}/></Field>
   <Field label="Deposit — not included in monthly invoices"><input name="deposit" type="number" min={0} step="0.01" defaultValue={contract?.deposit??0}/></Field>
   <label className={`${s.check} ${s.wide}`}><input name="prorate" type="checkbox" defaultChecked={contract?.prorate??true}/><span>Calculate partial first and last months by calendar days. Clear this only if the agreed full-month charge applies.</span></label>
  </div></section>
  <section className={s.panel}><h2>Recurring invoice</h2><div className={s.grid}>
   <Field label="Periodic invoice subject" wide><input required maxLength={500} value={subject} onChange={e=>setSubject(e.target.value)}/></Field>
   <Field label="Invoice month language"><select value={language} onChange={e=>setLanguage(e.target.value)}><option value="nl">Nederlands</option><option value="en">English</option><option value="es">Español</option></select></Field>
   <p className={s.help}>Available placeholders: {'{unitadres}'}, {'{maand}'}, {'{jaar}'}. The month always comes from the rental period.</p>
   <div className={`${s.preview} ${s.wide}`}>{example??'Choose a complete first invoice month to preview the subject (YYYY-MM).'}</div>
  </div><div className={s.toolbar}><button type="button" className={s.secondary} disabled={!chosen.length} onClick={suggestAmounts}>Suggest amounts from selected units</button></div>
  <p className={s.help}>Amounts exclude VAT. Check each VAT treatment. Unknown advances remain empty and must be confirmed or removed before saving.</p>
  {lines.map((l,i)=><div className={s.line} key={i}><Field label="Description"><input required maxLength={200} value={l.description} onChange={e=>setLines(prev=>prev.map((x,n)=>n===i?{...x,description:e.target.value}:x))}/></Field><Field label="Monthly amount"><input required type="number" min={0} step="0.01" value={l.amount} onChange={e=>setLines(prev=>prev.map((x,n)=>n===i?{...x,amount:e.target.value}:x))}/></Field><Field label="VAT"><select required value={l.vat} onChange={e=>setLines(prev=>prev.map((x,n)=>n===i?{...x,vat:e.target.value}:x))}><option value="">Choose</option><option value="exempt">Exempt</option><option value="0">0%</option><option value="9">9%</option><option value="21">21%</option></select></Field><button type="button" aria-label={`Remove line ${i+1}`} className={s.secondary} disabled={lines.length===1} onClick={()=>setLines(prev=>prev.filter((_,n)=>n!==i))}>×</button></div>)}
  <button type="button" className={s.secondary} disabled={lines.length>=20} onClick={()=>setLines(prev=>[...prev,{description:'',amount:'',vat:''}])}>Add invoice line</button>
  </section>
  <section className={s.panel}><Field label="Internal notes / indexation agreement"><textarea name="notes" rows={3} maxLength={4000} defaultValue={field('notes')}/></Field><p className={s.help}>Indexation is recorded here for reference; it does not automatically change the agreed amounts.</p><div className={s.toolbar}><button type="submit" className={s.button} disabled={pending||!chosen.length}>{pending?'Saving…':'Save contract draft'}</button><button type="button" className={s.secondary} onClick={onCancel}>Cancel</button></div></section>
  </fieldset>
 </form>;
}

function InvoiceReview({invoice:i,pending,onReview}:{invoice:Invoice;pending:boolean;onReview:(checked:boolean,note:string)=>void}){
 const [note,setNote]=useState(i.review_note);
 return <section className={s.panel}><p className={s.label}>CONCEPT INVOICE · {i.id.slice(0,8)}</p><h2>{i.subject}</h2><div className={s.details}><div><span className={s.label}>FROM</span><p>{i.snapshot.issuer_name}<br/>{i.snapshot.issuer_address}<br/>{i.snapshot.issuer_iban}<br/>{i.snapshot.issuer_tax_id}</p></div><div><span className={s.label}>TO</span><p>{i.snapshot.tenant_name}<br/>{i.snapshot.tenant_address}<br/>{i.snapshot.customer_reference}</p></div></div><p className={s.status}>Rental period: {date(i.period_start)} — {date(i.period_end)}<br/>Covered days: {date(i.snapshot.covered_from)} — {date(i.snapshot.covered_to)}<br/>Scheduled date: {date(i.scheduled_date)} · Due date: {date(i.due_date)}</p>
 <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Description</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead><tbody>{i.lines.map((l,n)=><tr key={n}><td>{l.description}</td><td>{euros(l.net)}</td><td>{l.vat==='exempt'?'Exempt':`${l.vat}% · ${euros(l.tax)}`}</td><td>{euros(l.total)}</td></tr>)}</tbody></table></div><p className={`${s.summary} ${s.money}`}>Subtotal {euros(i.subtotal)}<br/>VAT {euros(i.tax_total)}<br/><strong>Total {euros(i.total)}</strong></p><Field label="Review notes"><textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></Field><div className={s.toolbar}><button className={s.button} disabled={pending} onClick={()=>onReview(true,note)}>Mark checked</button><button className={s.secondary} disabled={pending} onClick={()=>onReview(false,note)}>Keep for review</button></div><p className={s.help}>Checking a draft records your review. Issuing, corrections and sending will be added before the Production cutover.</p></section>;
}

function Documents({contractId}:{contractId:string}){
 const [documents,setDocuments]=useState<{name:string;url:string}[]>([]);const [error,setError]=useState('');const [pending,startTransition]=useTransition();
 function load(){startTransition(async()=>{try{const r=await leaseDocuments(contractId);setError(r.error||'');setDocuments(r.documents||[]);}catch{setError('Documents could not be loaded.');}})}
 return <div className={s.summary}><h3>Signed agreement &amp; attachments</h3><p className={s.help}>Private PDFs, up to 10 MB each. Opened documents use a short-lived link in a new tab.</p><div className={s.toolbar}><button type="button" className={s.secondary} disabled={pending} onClick={load}>Show / refresh documents</button></div><ul className={s.files}>{documents.map((d,i)=><li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.name}</a></li>)}</ul>{error&&<p role="alert" className={s.error}>{error}</p>}<form onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const file=new FormData(form).get('document') as File;setError('');startTransition(async()=>{try{if(!file||file.size>10485760||file.type!=='application/pdf'||new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw new Error('Choose a PDF up to 10 MB.');const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const {error:failure}=await createClient().storage.from('mzs-lease-documents').upload(`${contractId}/${crypto.randomUUID()}-${name}`,file,{contentType:'application/pdf',upsert:false});if(failure)throw failure;form.reset();load();}catch(cause){setError(cause instanceof Error?cause.message:'Upload failed.');}});}}><Field label="Upload signed contract PDF"><input name="document" type="file" accept="application/pdf" required disabled={pending}/></Field><div className={s.toolbar}><button type="submit" className={s.secondary} disabled={pending}>Upload private PDF</button></div></form></div>;
}
