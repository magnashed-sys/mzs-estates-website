'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../../../lib/supabase/client';
import { euros } from '../../../../../lib/estates/rent';
import { invoiceMonthStart, leaseSubjectPreview, leasePreparationDate } from '../../../../../lib/estates/lease-month';
import { issueInvoice, saveContract, setContractStatus, generateDrafts, reviewInvoice, leaseDocuments } from './actions';
import s from './contracts.module.css';
import {relationshipDelivery, type RelationshipRecord as LeaseRelationship} from '../../../../../lib/relationships/model';

import {Issuers,Billing,type Issuer,type Issued,type Payment} from './billing';

type Property={id:string;name:string;owner_name:string;address:string};
type Unit={id:string;property_id:string;address:string;tenant_name:string|null;monthly_rent:number;utilities_advance:number|null;rent_included:boolean};
type Member={id:string;full_name:string|null;email:string};
type Line={description:string;amount:string;vat:string};
type Contract={id:string;version:number;status:string;title:string;property_id:string;unit_ids:string[];tenant_profile_id:string|null;tenant_relationship_id:string|null;tenant_name:string;tenant_address:string;tenant_email:string;tenant_tax_id?:string;tenant_attention?:string;issuer_id:string|null;issuer_name:string;issuer_address:string;issuer_iban:string;issuer_tax_id:string;issuer_registration?:string;contract_date:string;lease_start:string;lease_end:string|null;first_period:string;first_generation_date:string;max_terms:number|null;payment_days:number;payment_conditions:string;customer_reference:string;invoice_subject:string;invoice_language:string;planning_color:string;deposit:number;prorate:boolean;lines:Line[];notes:string};
type Invoice={id:string;contract_id:string;period_start:string;period_end:string;scheduled_date:string;due_date:string;subject:string;snapshot:Contract&{unit_addresses:string;covered_from:string;covered_to:string};lines:(Line&{net:number;tax:number;total:number})[];subtotal:number;tax_total:number;total:number;review_status:string;review_note:string};
type Props={companies?:import('../../../../../lib/estates/issuer-profile').CompanySource[];issuers?:Issuer[];issued?:Issued[];payments?:Payment[];relationships:LeaseRelationship[];properties:Property[];units:Unit[];members:Member[];contracts:Contract[];invoices:Invoice[]};
const date=(v:string, adminLocale = 'en-GB')=>new Intl.DateTimeFormat(adminLocale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <label className={`${s.field} ${wide?s.wide:''}`}><span>{adminT(label)}</span>{children}</label>}

export default function ContractWorkspace({relationships,properties,units,members,contracts,invoices,companies=[],issuers=[],issued=[],payments=[]}:Props){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const router=useRouter();const [pending,startTransition]=useTransition();
 const searchParams=useSearchParams();
 const view=searchParams.get('view');
 const tab=view==='invoices'||view==='issuers'||view==='billing'?view:'contracts';
 function setTab(next:'contracts'|'invoices'|'issuers'|'billing'){
  const url=new URL(window.location.href);url.searchParams.set('view',next);
  window.history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 const [editing,setEditing]=useState<Contract|null|undefined>(undefined);
 const [selected,setSelected]=useState<string|null>(searchParams.get('contract'));
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [filter,setFilter]=useState('');const [propertyFilter,setPropertyFilter]=useState(searchParams.get('property')||'');
 const [invoiceId,setInvoiceId]=useState<string|null>(null);
 const unitFilter=searchParams.get('unit');
 const profileFilter=searchParams.get('profile');
 const profileRelationships=new Set(relationships.filter(r=>r.profile_id===profileFilter).map(r=>r.id));
 const scopedContracts=profileFilter?contracts.filter(c=>c.tenant_profile_id===profileFilter || (!c.tenant_profile_id && !!c.tenant_relationship_id && profileRelationships.has(c.tenant_relationship_id))):contracts;
 const contractIds=new Set(scopedContracts.map(c=>c.id));
 const scopedInvoices=profileFilter?invoices.filter(i=>contractIds.has(i.contract_id)):invoices;
 const scopedIssued=profileFilter?issued.filter(i=>contractIds.has(i.contract_id)):issued;
 const issuedIds=new Set(scopedIssued.map(i=>i.id));
 const scopedPayments=profileFilter?payments.filter(p=>issuedIds.has(p.invoice_id)):payments;
 const selectedContract=scopedContracts.find(c=>c.id===selected);
 const visibleInvoices=unitFilter?scopedInvoices.filter(i=>i.snapshot.unit_ids.includes(unitFilter)):scopedInvoices;
 const invoice=visibleInvoices.find(i=>i.id===invoiceId);
 function run(action:()=>Promise<{error?:string;message?:string}>) {setError('');setNotice('');startTransition(async()=>{try{const r=await action();if(r.error)setError(r.error);else{setNotice(r.message || 'Saved.');router.refresh();}}catch{setError('The action could not be verified. Refresh the page before trying again.');}});}
 const shown=scopedContracts.filter(c=>(!propertyFilter||c.property_id===propertyFilter)&&(!filter||`${c.title} ${c.tenant_name}`.toLowerCase().includes(filter.toLowerCase())));
 return <>
  <div className={s.notice}>{adminT("Monthly draft preparation starts with December 2026. Drafts are prepared on the 14th of the preceding month. Check each draft, explicitly approve its issue, then send the numbered invoice separately. Staging delivery is captured without emailing tenants.")}</div>
  <div className={s.metrics}><div><span className={s.label}>{adminT("CONTRACTS")}</span><strong>{scopedContracts.length}</strong></div><div><span className={s.label}>{adminT("ACTIVE SCHEDULES")}</span><strong>{scopedContracts.filter(c=>c.status==='active').length}</strong></div><div><span className={s.label}>{adminT("DRAFTS TO REVIEW")}</span><strong>{scopedInvoices.filter(i=>i.review_status==='pending'&&!issued.some(f=>f.draft_id===i.id)).length}</strong></div></div>
  {profileFilter&&<p className={s.notice}>{adminT("Showing contracts and invoices for")} {members.find(m=>m.id===profileFilter)?.full_name || adminT("the selected account")}. <Link href="/admin/group/estates/contracts">{adminT("Show all relationships →")}</Link></p>}
  <div className={s.tabs}><button className={s.secondary} aria-pressed={tab==='contracts'} onClick={()=>setTab('contracts')}>{adminT("Contracts")}</button><button className={s.secondary} aria-pressed={tab==='invoices'} onClick={()=>setTab('invoices')}>{adminT("Invoice drafts")}</button><button className={s.secondary} aria-pressed={tab==='issuers'} onClick={()=>setTab('issuers')}>{adminT("Issuing entities")}</button><button className={s.secondary} aria-pressed={tab==='billing'} onClick={()=>setTab('billing')}>{adminT("Invoices & cashflow")}</button></div>
  {error&&<p role="alert" className={s.error}>{adminT(error)}</p>}{notice&&<p role="status" className={s.notice}>{adminT(notice)}</p>}
  {tab==='issuers'?<Issuers issuers={issuers} relationships={relationships} companies={companies} members={members}/>:tab==='billing'?<Billing issued={scopedIssued} payments={scopedPayments}/>:tab==='contracts'?<>
   <div className={s.toolbar}><button className={s.button} onClick={()=>{setEditing(null);setSelected(null);setError('');setNotice('')}}>{adminT("New contract")}</button></div>
   {editing!==undefined&&<ContractForm key={editing?.id || 'new'} contract={editing} properties={properties} units={units} members={members} relationships={relationships} issuers={issuers} pending={pending} onCancel={()=>setEditing(undefined)} onSave={payload=>run(async()=>{const r=await saveContract(payload,editing?.id,editing?.version);if(r.error)return r;setEditing(undefined);setSelected(r.id || null);return {message:'Contract saved as a draft. Review the agreement before activating monthly billing.'};})}/>}
   <p className={s.help}>{adminT("Manage clients, companies and tenant roles in")} <Link href="/admin/relationships">{adminT("Relationships")}</Link>.</p><div className={s.grid}><Field label={adminT("Search contracts")}><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder={adminT("Contract or tenant")}/></Field><Field label={adminT("Property")}><select value={propertyFilter} onChange={e=>setPropertyFilter(e.target.value)}><option value="">{adminT("All properties")}</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
   {shown.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Contract / tenant")}</th><th>{adminT("First invoice period")}</th><th>{adminT("Monthly net amount")}</th><th>{adminT("Status")}</th></tr></thead><tbody>{shown.map(c=><tr key={c.id}><td><button onClick={()=>{setSelected(c.id);setEditing(undefined)}}>{c.title}</button><small>{c.tenant_name}</small></td><td>{date(c.first_period, adminLocale)}</td><td>{euros(c.lines.reduce((sum,l)=>sum+Math.round(Number(l.amount)*100),0)/100, adminLocale)}</td><td><span className={s.badge}>{adminT(c.status)}</span></td></tr>)}</tbody></table></div>:<p className={s.empty}>{adminT("No contracts match this view. Start with a draft and link the units covered by the agreement.")}</p>}
   {selectedContract&&<section className={s.panel}><h2>{selectedContract.title}</h2><div className={s.details}><div><span className={s.label}>{adminT("TENANT")}</span><p>{selectedContract.tenant_name}<br/>{selectedContract.tenant_address}<br/>{selectedContract.tenant_email}</p></div><div><span className={s.label}>{adminT("ISSUER")}</span><p>{selectedContract.issuer_name}<br/>{selectedContract.issuer_address}<br/>{selectedContract.issuer_iban}</p></div></div>
    <p className={s.status}>{units.filter(u=>selectedContract.unit_ids.includes(u.id)).map(u=>u.address).join(' · ')}</p>
    <p className={s.status}>{adminT("Lease:")} {date(selectedContract.lease_start, adminLocale)} — {selectedContract.lease_end?date(selectedContract.lease_end, adminLocale):adminT("open-ended")}<br/>{adminT("First invoice period:")} {date(selectedContract.first_period, adminLocale)}  {adminT("· First preparation:")} {date(selectedContract.first_generation_date, adminLocale)}<br/>{adminT("Monthly ·")} {selectedContract.max_terms?adminT("{p0} periods maximum", {p0: selectedContract.max_terms}):adminT("until stopped or lease end")}  {adminT("· Payment must be received before the first day of the rental month")}<br/>{adminT("Partial months:")} {selectedContract.prorate?adminT("calendar-day proration"):adminT("full monthly amount")}  {adminT("· Deposit:")} {euros(selectedContract.deposit, adminLocale)}  {adminT("(not recurring)")}</p>
    <p className={s.preview}>{selectedContract.invoice_subject}</p>
    <div className={s.toolbar}>{selectedContract.status==='draft'?<><button className={s.secondary} disabled={pending} onClick={()=>setEditing(selectedContract)}>{adminT("Edit draft")}</button><button className={s.button} disabled={pending} onClick={()=>{if(window.confirm(adminT("Activate monthly draft preparation for this contract? Check the first invoice period and confirm that the amounts and units are correct. Activated terms are locked.")))run(async()=>{const r=await setContractStatus(selectedContract.id,selectedContract.version,'active');return {...r,message:'Monthly draft preparation activated. Due periods will be included in the next daily run.'};});}}>{adminT("Activate schedule")}</button></>:selectedContract.status==='active'?<button className={s.secondary} disabled={pending} onClick={()=>{if(window.confirm(adminT("Stop future draft preparation? Existing drafts remain available. This does not terminate the legal rental agreement.")))run(async()=>{const r=await setContractStatus(selectedContract.id,selectedContract.version,'stopped');return {...r,message:'Draft preparation stopped. Existing documents are retained.'};});}}>{adminT("Stop billing schedule")}</button>:null}</div>
    {selectedContract.status!=='draft'&&<p className={s.help}>{adminT("Activated terms are retained for the audit history. For changed terms, stop this billing schedule and create a replacement draft starting with the agreed next invoice month. Review the existing drafts before activating the replacement.")}</p>}
    <Documents key={selectedContract.id} contractId={selectedContract.id}/>
   </section>}
  </>:<>
   <p className={s.status}>{adminT("The daily run prepares due periods for active contracts. Re-running it catches up missing periods without creating duplicates. The list follows the selected account and unit filters; preparing due drafts processes all active contracts.")}</p>
   <div className={s.toolbar}><button className={s.button} disabled={pending} onClick={()=>run(async()=>{const r=await generateDrafts();return {...r,message:`${r.count || 0} new invoice draft(s) prepared. Existing drafts were kept.`};})}>{adminT("Prepare due drafts now")}</button></div>
   {visibleInvoices.length?<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Invoice subject / tenant")}</th><th>{adminT("Period")}</th><th>{adminT("Issuer")}</th><th>{adminT("Total")}</th><th>{adminT("Review")}</th></tr></thead><tbody>{visibleInvoices.map(i=><tr key={i.id}><td><button onClick={()=>setInvoiceId(i.id)}>{i.subject}</button><small>{i.snapshot.tenant_name}</small></td><td>{date(i.period_start, adminLocale)}</td><td>{i.snapshot.issuer_name}</td><td className={s.money}>{euros(i.total, adminLocale)}</td><td><span className={s.badge}>{adminT(i.review_status)}</span></td></tr>)}</tbody></table></div>:<p className={s.empty}>{adminT("No invoice drafts yet. Activate a reviewed contract and prepare its due periods.")}</p>}
   {invoice&&<InvoiceReview key={invoice.id} invoice={invoice} issued={issued.find(i=>i.draft_id===invoice.id)} onIssue={()=>run(async()=>{const r=await issueInvoice(invoice.id);return {...r,message:'Invoice issued. Open Invoices & cashflow to view the PDF and approve sending.'};})} pending={pending} onReview={(checked,note)=>run(async()=>{const r=await reviewInvoice(invoice.id,checked,note);return {...r,message:'Review saved. This document remains a concept invoice.'};})}/>}
  </>}
 </>;
}

function ContractForm({contract,properties,units,members,relationships,issuers,pending,onSave,onCancel}:{contract:Contract|null;properties:Property[];units:Unit[];members:Member[];relationships:LeaseRelationship[];issuers:Issuer[];pending:boolean;onSave:(data:Record<string,unknown>)=>void;onCancel:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [property,setProperty]=useState(contract?.property_id || '');const [chosen,setChosen]=useState<string[]>(contract?.unit_ids || []);
 const [tenant,setTenant]=useState(contract?.tenant_name || '');const [email,setEmail]=useState(contract?.tenant_email || '');const [issuer,setIssuer]=useState(contract?.issuer_name || '');
 const [lines,setLines]=useState<Line[]>(contract?.lines || [{description:'Huur',amount:'',vat:'exempt'}]);
 const [subject,setSubject]=useState(contract?.invoice_subject || 'Huur {unitadres} — {maand} {jaar}');
 const [tenantTax,setTenantTax]=useState(contract?.tenant_tax_id||'');
 const [tenantAttention,setTenantAttention]=useState(contract?.tenant_attention||'');
 const [relationship,setRelationship]=useState(contract?.tenant_relationship_id||'');
 const [tenantProfile,setTenantProfile]=useState(contract?.tenant_profile_id||'');
 const [issuerId,setIssuerId]=useState(contract?.issuer_id||'');
 const [issuerAddress,setIssuerAddress]=useState(contract?.issuer_address||'');const [issuerIban,setIssuerIban]=useState(contract?.issuer_iban||'');const [issuerTax,setIssuerTax]=useState(contract?.issuer_tax_id||'');
 const [address,setAddress]=useState(contract?.tenant_address||'');
 const [language,setLanguage]=useState(contract?.invoice_language || 'nl');const [period,setPeriod]=useState(contract?.first_period?.slice(0,7)||'2026-12');
 const selectedUnits=units.filter(u=>chosen.includes(u.id));
 const example=leaseSubjectPreview(subject,period,language,selectedUnits.map(u=>u.address).sort().join(', '));
 function field(name:keyof Contract){return contract?.[name] as string | undefined;}
 function suggestAmounts(){setLines([{description:'Huur',amount:(selectedUnits.reduce((sum,u)=>sum+Math.round(Number(u.monthly_rent)*100),0)/100).toFixed(2),vat:'exempt'}, {description:'Voorschot nutsvoorzieningen',amount:selectedUnits.every(u=>u.utilities_advance!==null)?(selectedUnits.reduce((sum,u)=>sum+Math.round(Number(u.utilities_advance)*100),0)/100).toFixed(2):'',vat:''}]);if(!tenant)setTenant(selectedUnits[0]?.tenant_name||'');}
 return <form onSubmit={e=>{e.preventDefault();const firstPeriod=invoiceMonthStart(period);if(!firstPeriod){const input=e.currentTarget.elements.namedItem('first_invoice_month') as HTMLInputElement;input.setCustomValidity('Enter a complete month as YYYY-MM, for example 2026-11.');input.reportValidity();return;}const fd=new FormData(e.currentTarget);onSave({...Object.fromEntries(fd.entries()),property_id:property,unit_ids:chosen,tenant_profile_id:tenantProfile||null,tenant_relationship_id:relationship||null,issuer_id:issuerId||null,tenant_address:address,tenant_name:tenant,tenant_email:email,tenant_tax_id:tenantTax,tenant_attention:tenantAttention,issuer_name:issuer,lease_end:fd.get('lease_end')||null,first_period:firstPeriod,max_terms:fd.get('max_terms')?Number(fd.get('max_terms')):null,payment_days:14,deposit:Number(fd.get('deposit')||0),prorate:fd.has('prorate'),lines,invoice_subject:subject,invoice_language:language});}}>
  <fieldset disabled={pending} style={{border:0,padding:0,margin:0,minWidth:0}}>
  <section className={s.panel}><h2>{contract?adminT("Edit contract draft"):adminT("New rental contract")}</h2><p className={s.help}>{adminT("Addresses and IBAN may be completed later. They are required before activating billing.")}</p><div className={s.grid}>
   <Field label={adminT("Contract subject")}><input name="title" required maxLength={200} defaultValue={field('title')}/></Field>
   <Field label={adminT("Contract date")}><input name="contract_date" type="date" required defaultValue={field('contract_date') || today()}/></Field>
   <Field label={adminT("Property")} wide><select required value={property} onChange={e=>{setProperty(e.target.value);setChosen([]);if(!issuerId)setIssuer(properties.find(p=>p.id===e.target.value)?.owner_name||'');}}><option value="">{adminT("Select property")}</option>{properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>
   <div className={s.wide}><p className={s.label}>{adminT("UNITS COVERED BY THIS CONTRACT")}</p><div className={s.checks}>{units.filter(u=>u.property_id===property).map(u=><label key={u.id} className={s.check}><input type="checkbox" checked={chosen.includes(u.id)} onChange={e=>setChosen(prev=>e.target.checked?[...prev,u.id]:prev.filter(id=>id!==u.id))}/><span>{u.address}<br/><small className={s.help}>{u.rent_included?adminT("Rent included in another unit"):adminT("{p0} recorded monthly rent", {p0: euros(u.monthly_rent)})}</small></span></label>)}</div></div>
   <Field label={adminT("Existing relationship (optional)")} wide><select value={relationship} onChange={e=>{const id=e.target.value;setRelationship(id);const r=relationships.find(r=>r.id===id);setTenantProfile(r?.profile_id||'');if(r){const delivery=relationshipDelivery(r);setTenant(r.name);setEmail(delivery.email);setAddress(delivery.address);setTenantAttention(delivery.attention);setTenantTax(r.kind==='company'?r.company_details?.tax_id||'':'')}}}><option value="">{adminT("Enter tenant details manually")}</option>{relationships.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
   <Field label={adminT("Link existing login account (optional)")}><select name="tenant_profile_id" value={tenantProfile} disabled={!!relationship} onChange={e=>{setTenantProfile(e.target.value);const m=members.find(x=>x.id===e.target.value);if(m&&!relationship){setTenant(m.full_name||m.email);setEmail(m.email);setTenantTax('');setTenantAttention('')}}}><option value="">{adminT("Tenant without linked account")}</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name||m.email}</option>)}</select></Field>
   <p className={s.help}>{adminT("The linked relationship supplies its existing client account. Activated contracts and issued invoices are visible only to that account. A draft is private to administrators.")}</p>
   <Field label={adminT("Tenant / legal company name")}><input required maxLength={200} value={tenant} onChange={e=>setTenant(e.target.value)}/></Field>
   <Field label={adminT("Tenant VAT / tax number (optional)")}><input name="tenant_tax_id" maxLength={60} value={tenantTax} onChange={e=>setTenantTax(e.target.value)}/></Field>
   <Field label={adminT("Invoice attention (t.a.v., optional)")}><input name="tenant_attention" maxLength={180} value={tenantAttention} onChange={e=>setTenantAttention(e.target.value)}/></Field>
   <p className={s.help}>{adminT("Selecting a company copies its invoice address, invoice email, attention and VAT number. Review before saving. Existing contracts retain their saved details.")}</p>
   <Field label={adminT("Tenant billing address")}><textarea name="tenant_address" maxLength={1000} rows={3} value={address} onChange={e=>setAddress(e.target.value)}/></Field>
   <Field label={adminT("Tenant email")}><input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></Field>
   <Field label={adminT("Registered issuing entity")}><select value={issuerId} onChange={e=>{setIssuerId(e.target.value);const entity=issuers.find(i=>i.id===e.target.value);if(entity){setIssuer(entity.name);setIssuerAddress(entity.address);setIssuerIban(entity.iban);setIssuerTax(entity.tax_id)}}}><option value="">{adminT("Select an entity for invoice issuing")}</option>{issuers.map(i=><option key={i.id} value={i.id}>{i.name} · {i.prefix}</option>)}</select></Field>
   <p className={s.help}>{adminT("Create the landlord under Issuing entities first. Selecting it copies its billing details when saving; saved contracts retain their own snapshot.")}</p>
   <Field label={adminT("Landlord / issuing legal entity")}><input required maxLength={200} value={issuer} onChange={e=>setIssuer(e.target.value)}/></Field>
   <Field label={adminT("Issuer billing address")}><textarea name="issuer_address" maxLength={1000} rows={3} value={issuerAddress} readOnly={!!issuerId} onChange={e=>setIssuerAddress(e.target.value)}/></Field>
   <Field label={adminT("Issuer IBAN")}><input name="issuer_iban" maxLength={40} value={issuerIban} readOnly={!!issuerId} onChange={e=>setIssuerIban(e.target.value)}/></Field>
   <Field label={adminT("Issuer tax identification (if applicable)")}><input name="issuer_tax_id" maxLength={60} value={issuerTax} readOnly={!!issuerId} onChange={e=>setIssuerTax(e.target.value)}/></Field>
  </div></section>
  <section className={s.panel}><h2>{adminT("Agreement & monthly schedule")}</h2><div className={s.grid}>
   <Field label={adminT("Lease start")}><input name="lease_start" type="date" required defaultValue={field('lease_start')}/></Field>
   <Field label={adminT("Lease end (optional)")}><input name="lease_end" type="date" defaultValue={field('lease_end')||''}/></Field>
   <Field label={adminT("First invoice month in MZS")}><input name="first_invoice_month" type="month" required min="2026-12" max="2100-12" pattern="[0-9]{4}-(0[1-9]|1[0-2])" placeholder={adminT("YYYY-MM")} title={adminT("Enter the year and month, for example 2026-11.")} value={period} onChange={e=>{const input=e.currentTarget;input.setCustomValidity(input.value&&!invoiceMonthStart(input.value)?'Enter a complete month as YYYY-MM, for example 2026-11.':'');setPeriod(input.value);}}/></Field>
   <Field label={adminT("First draft preparation date")}><input name="first_generation_date" type="date" value={leasePreparationDate(period)} readOnly/></Field>
   <p className={`${s.help} ${s.wide}`}>{adminT("Frequency: every month, starting December 2026 or later. Drafts are prepared on the 14th of the preceding month; December starts on 14 November 2026. Payment must be received before the first day of the rental month.")}</p>
   <Field label={adminT("Maximum invoice periods (blank = ongoing)")}><input name="max_terms" type="number" min={1} max={600} defaultValue={contract?.max_terms||''}/></Field>
   <Field label={adminT("Payment deadline")}><input value="Before the first day of the rental month" readOnly/></Field>
   <Field label={adminT("Payment method")}><input value="Bank transfer" readOnly/></Field>
   <Field label={adminT("Customer reference")}><input name="customer_reference" maxLength={200} defaultValue={field('customer_reference')}/></Field>
   <Field label={adminT("Payment conditions")} wide><textarea name="payment_conditions" maxLength={1000} defaultValue={field('payment_conditions')}/></Field>
   <Field label={adminT("Planning colour")}><input name="planning_color" type="color" defaultValue={field('planning_color')||'#c8b18a'}/></Field>
   <Field label={adminT("Deposit — not included in monthly invoices")}><input name="deposit" type="number" min={0} step="0.01" defaultValue={contract?.deposit??0}/></Field>
   <label className={`${s.check} ${s.wide}`}><input name="prorate" type="checkbox" defaultChecked={contract?.prorate??true}/><span>{adminT("Calculate partial first and last months by calendar days. Clear this only if the agreed full-month charge applies.")}</span></label>
  </div></section>
  <section className={s.panel}><h2>{adminT("Recurring invoice")}</h2><div className={s.grid}>
   <Field label={adminT("Periodic invoice subject")} wide><input required maxLength={500} value={subject} onChange={e=>setSubject(e.target.value)}/></Field>
   <Field label={adminT("Invoice month language")}><select value={language} onChange={e=>setLanguage(e.target.value)}><option value="nl">{adminT("Dutch")}</option><option value="en">{adminT("English")}</option><option value="es">{adminT("Spanish")}</option></select></Field>
   <p className={s.help}>{adminT("Available placeholders:")} {adminT("{unitadres}")}, {adminT("{maand}")}, {adminT("{jaar}")}{adminT(". The month always comes from the rental period.")}</p>
   <div className={`${s.preview} ${s.wide}`}>{example??adminT("Choose a complete first invoice month to preview the subject (YYYY-MM).")}</div>
  </div><div className={s.toolbar}><button type="button" className={s.secondary} disabled={!chosen.length} onClick={suggestAmounts}>{adminT("Suggest amounts from selected units")}</button></div>
  <p className={s.help}>{adminT("Amounts exclude VAT. Check each VAT treatment. Unknown advances remain empty and must be confirmed or removed before saving.")}</p>
  {lines.map((l,i)=><div className={s.line} key={i}><Field label={adminT("Description")}><input required maxLength={200} value={l.description} onChange={e=>setLines(prev=>prev.map((x,n)=>n===i?{...x,description:e.target.value}:x))}/></Field><Field label={adminT("Monthly amount")}><input required type="number" min={0} step="0.01" value={l.amount} onChange={e=>setLines(prev=>prev.map((x,n)=>n===i?{...x,amount:e.target.value}:x))}/></Field><Field label={adminT("VAT")}><select required value={l.vat} onChange={e=>setLines(prev=>prev.map((x,n)=>n===i?{...x,vat:e.target.value}:x))}><option value="">{adminT("Choose")}</option><option value="exempt">{adminT("Exempt")}</option><option value="0">0%</option><option value="9">9%</option><option value="21">21%</option></select></Field><button type="button" aria-label={adminT("Remove line {p0}", {p0: i+1})} className={s.secondary} disabled={lines.length===1} onClick={()=>setLines(prev=>prev.filter((_,n)=>n!==i))}>{adminT("×")}</button></div>)}
  <button type="button" className={s.secondary} disabled={lines.length>=20} onClick={()=>setLines(prev=>[...prev,{description:'',amount:'',vat:''}])}>{adminT("Add invoice line")}</button>
  </section>
  <section className={s.panel}><Field label={adminT("Internal notes / indexation agreement")}><textarea name="notes" rows={3} maxLength={4000} defaultValue={field('notes')}/></Field><p className={s.help}>{adminT("Indexation is recorded here for reference; it does not automatically change the agreed amounts.")}</p><div className={s.toolbar}><button type="submit" className={s.button} disabled={pending||!chosen.length}>{pending?adminT("Saving…"):adminT("Save contract draft")}</button><button type="button" className={s.secondary} onClick={onCancel}>{adminT("Cancel")}</button></div></section>
  </fieldset>
 </form>;
}

function InvoiceReview({invoice:i,issued,pending,onIssue,onReview}:{invoice:Invoice;issued?:Issued;onIssue:()=>void;pending:boolean;onReview:(checked:boolean,note:string)=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [note,setNote]=useState(i.review_note);
 return <section className={s.panel}><p className={s.label}>{adminT("CONCEPT INVOICE ·")} {i.id.slice(0,8)}</p><h2>{i.subject}</h2><div className={s.details}><div><span className={s.label}>{adminT("FROM")}</span><p>{i.snapshot.issuer_name}<br/>{i.snapshot.issuer_address}<br/>{i.snapshot.issuer_iban}<br/>{i.snapshot.issuer_tax_id}{i.snapshot.issuer_registration&&<><br/>{adminT("Registration:")} {i.snapshot.issuer_registration}</>}</p></div><div><span className={s.label}>{adminT("TO")}</span><p>{i.snapshot.tenant_name}{i.snapshot.tenant_attention&&<><br/>{adminT("Attn:")} {i.snapshot.tenant_attention}</>}<br/>{i.snapshot.tenant_address}{i.snapshot.tenant_tax_id&&<><br/>{adminT("Tax ID:")} {i.snapshot.tenant_tax_id}</>}<br/>{i.snapshot.customer_reference}</p></div></div><p className={s.status}>{adminT("Rental period:")} {date(i.period_start, adminLocale)} — {date(i.period_end, adminLocale)}<br/>{adminT("Covered days:")} {date(i.snapshot.covered_from, adminLocale)} — {date(i.snapshot.covered_to, adminLocale)}<br/>{adminT("Scheduled date:")} {date(i.scheduled_date, adminLocale)}  {adminT("· Due date:")} {date(i.due_date, adminLocale)}</p>
 <div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Description")}</th><th>{adminT("Net")}</th><th>{adminT("VAT")}</th><th>{adminT("Total")}</th></tr></thead><tbody>{i.lines.map((l,n)=><tr key={n}><td>{l.description}</td><td>{euros(l.net, adminLocale)}</td><td>{l.vat==='exempt'?adminT("Exempt"):adminT("{p0}% · {p1}", {p0: l.vat, p1: euros(l.tax)})}</td><td>{euros(l.total, adminLocale)}</td></tr>)}</tbody></table></div><p className={`${s.summary} ${s.money}`}>{adminT("Subtotal")} {euros(i.subtotal, adminLocale)}<br/>{adminT("VAT")} {euros(i.tax_total, adminLocale)}<br/><strong>{adminT("Total")} {euros(i.total, adminLocale)}</strong></p><Field label={adminT("Review notes")}><textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></Field><div className={s.toolbar}><button className={s.button} disabled={pending||!!issued} onClick={()=>onReview(true,note)}>{adminT("Mark checked")}</button><button className={s.secondary} disabled={pending||!!issued} onClick={()=>onReview(false,note)}>{adminT("Keep for review")}</button></div><p className={s.help}>{adminT("Checking records your review. Issuing assigns a permanent number and locks the invoice. Sending is a separate step. An issued invoice cannot be edited.")}</p>{issued?<p>{adminT("Issued as")} {issued.number}{adminT(". Open Invoices & cashflow for the PDF, delivery and payments.")}</p>:<button className={s.button} disabled={pending||i.review_status!=='checked'} onClick={()=>{if(window.confirm(adminT("Approve and issue this checked invoice with a permanent number? Verify the tenant, issuer, amounts, tax and payment details. This cannot be undone.")))onIssue();}}>{adminT("Approve & issue invoice")}</button>}</section>;
}

function Documents({contractId}:{contractId:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [documents,setDocuments]=useState<{name:string;url:string}[]>([]);const [error,setError]=useState('');const [pending,startTransition]=useTransition();
 function load(){startTransition(async()=>{try{const r=await leaseDocuments(contractId);setError(r.error||'');setDocuments(r.documents||[]);}catch{setError('Documents could not be loaded.');}})}
 return <div className={s.summary}><h3>{adminT("Signed agreement & attachments")}</h3><p className={s.help}>{adminT("Private PDFs, up to 10 MB each. Opened documents use a short-lived link in a new tab.")}</p><div className={s.toolbar}><button type="button" className={s.secondary} disabled={pending} onClick={load}>{adminT("Show / refresh documents")}</button></div><ul className={s.files}>{documents.map((d,i)=><li key={i}><a href={d.url} target="_blank" rel="noopener noreferrer">{d.name}</a></li>)}</ul>{error&&<p role="alert" className={s.error}>{adminT(error)}</p>}<form onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const file=new FormData(form).get('document') as File;setError('');startTransition(async()=>{try{if(!file||file.size>10485760||file.type!=='application/pdf'||new TextDecoder().decode(await file.slice(0,5).arrayBuffer())!=='%PDF-')throw new Error('Choose a PDF up to 10 MB.');const name=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const {error:failure}=await createClient().storage.from('mzs-lease-documents').upload(`${contractId}/${crypto.randomUUID()}-${name}`,file,{contentType:'application/pdf',upsert:false});if(failure)throw failure;form.reset();load();}catch(cause){setError(cause instanceof Error?cause.message:'Upload failed.');}});}}><Field label={adminT("Upload signed contract PDF")}><input name="document" type="file" accept="application/pdf" required disabled={pending}/></Field><div className={s.toolbar}><button type="submit" className={s.secondary} disabled={pending}>{adminT("Upload private PDF")}</button></div></form></div>;
}
