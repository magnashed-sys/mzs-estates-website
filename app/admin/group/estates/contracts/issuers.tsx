'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

import CountrySelect from "../../../../components/CountrySelect";
import PhoneInput from "../../../../components/PhoneInput";
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {saveIssuer,importIssuerPerson} from './actions';
import type {Issuer} from './billing';
import type {LeaseRelationship} from './relationships';
import {issuerFields,type CompanySource} from '../../../../../lib/estates/issuer-profile';
import {unextendedMembers,type RelationshipMember} from '../../../../../lib/relationships/model';
import s from './contracts.module.css';
export default function Issuers({issuers,relationships,companies,members=[]}:{issuers:Issuer[];relationships:LeaseRelationship[];companies:CompanySource[];members?:RelationshipMember[]}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [editing,setEditing]=useState<Issuer|null|undefined>();
 return <><h2>{adminT("Issuing entities")}</h2><p className={s.help}>{adminT("Manage the legal and payment details for each landlord. Existing contracts and issued invoices keep their saved details. Each invoice prefix has its own sequence.")}</p><button className={s.button} onClick={()=>setEditing(null)}>{adminT("New issuing entity")}</button>
 {editing!==undefined&&<IssuerForm key={editing?.id||'new'} issuer={editing} companies={companies} relationships={relationships} members={members} close={()=>setEditing(undefined)}/>}
 <div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Entity")}</th><th>{adminT("Type / country")}</th><th>{adminT("IBAN")}</th><th>{adminT("Next number")}</th></tr></thead><tbody>{issuers.map(i=><tr key={i.id}><td><button onClick={()=>setEditing(i)}>{i.name}</button></td><td>{i.kind==='person'?adminT("Private landlord"):adminT("Company")}<small>{i.details?.country}</small></td><td>{i.iban}</td><td>{i.prefix}-{String(i.next_number).padStart(6,'0')}</td></tr>)}</tbody></table></div></>;
}
function IssuerForm({issuer,companies,relationships,members,close}:{issuer:Issuer|null;companies:CompanySource[];relationships:LeaseRelationship[];members:RelationshipMember[];close:()=>void}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [values,setValues]=useState<Record<string,string>>(()=>({...Object.fromEntries(Object.entries(issuer||{}).filter(([,v])=>typeof v==='string')),...issuer?.details,kind:issuer?.kind||'company'}) as Record<string,string>);
 const [savedAddress,setSavedAddress]=useState(()=>issuer?.address&&![issuer.details?.street,issuer.details?.house_number,issuer.details?.postal_code,issuer.details?.city].some(Boolean)?issuer.address:'');
 const [useSavedAddress,setUseSavedAddress]=useState(!!savedAddress);
 const [personSource,setPersonSource]=useState(issuer?.kind==='person'&&issuer.relationship_id?`relationship:${issuer.relationship_id}`:'');
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');const [busy,start]=useTransition();const [loadingLogo,setLoadingLogo]=useState(false);const router=useRouter();
 function change(key:string,value:string){setValues(v=>({...v,[key]:value}));}
 function copyPerson(source:string){
  if(!source){setPersonSource('');change('relationship_id','');setNotice('');return;}
  if([values.name,values.address,values.street,values.email,values.phone].some(Boolean)&&!window.confirm(adminT("Replace the name, address and contact details with this person’s saved details? Bank and invoice settings stay unchanged; check them before saving.")))return;
  setError('');setNotice('');start(async()=>{try{
   const result=await importIssuerPerson(source);
   if(result.error||!result.fields){setError(result.error||'The person could not be loaded.');return;}
   setValues(v=>({...v,...result.fields}));setSavedAddress(result.fields.address);setUseSavedAddress(!!result.fields.address);setPersonSource(source);
   setNotice('Personal details copied. Review the fields and bank details, complete anything missing, then save. No account or relationship has been created or changed.');
  }catch{setError('The person could not be loaded. No form fields were changed.');}});
 }
 function field(key:string,label:string,max=200,required=false,type='text') {if(key==='phone')return <PhoneInput key={key} className={s.field} label={adminT(label)} value={values.phone||''} onChange={value=>change('phone',value)}/>;if(key==='country')return <label key={key} className={s.field}>{adminT(label)}<CountrySelect required={required} value={values.country||''} onChange={value=>change('country',value)}/></label>;return <label key={key} className={s.field}>{adminT(label)}{key==='payment_instructions'||key==='billing_address'?<textarea name={key} value={values[key]||''} maxLength={max} required={required} onChange={e=>change(key,e.target.value)}/>:<input name={key} value={values[key]||''} maxLength={max} required={required} type={type} onChange={e=>change(key,e.target.value)}/>}</label>}
 return <form className={s.panel} onSubmit={e=>{e.preventDefault();setError('');const input=useSavedAddress?{...values,street:'',house_number:'',address_extra:'',postal_code:'',city:'',region:''}:values;start(async()=>{try{const result=await saveIssuer(input,issuer?.id,issuer?.version);if(result.error)setError(result.error);else{close();router.refresh();}}catch{setError('Saving could not be confirmed. Refresh before retrying.');}});}}>
 <fieldset disabled={busy||loadingLogo}><h3>{adminT("Legal identity")}</h3><div className={s.grid}>
 <label className={s.field}>{adminT("Landlord type")}<select value={values.kind} onChange={e=>{const kind=e.target.value;setValues(v=>({...v,kind,relationship_id:'',source_company_id:''}));setPersonSource('');setNotice('');}}><option value="company">{adminT("Company")}</option><option value="person">{adminT("Private landlord")}</option></select></label>
 {values.kind==='person'?<><label className={s.field}>{adminT("Copy details from person")}<select value={personSource} onChange={e=>copyPerson(e.target.value)}><option value="">{adminT("Enter details manually")}</option><option value="self">{adminT("My profile (signed-in administrator)")}</option>{relationships.filter(r=>r.kind==='person').map(r=><option key={r.id} value={`relationship:${r.id}`}>{r.name}{r.email?adminT("· {p0}", {p0: r.email}):''}</option>)}{unextendedMembers(relationships,members).map(m=><option key={m.id} value={`profile:${m.id}`}>{m.full_name||m.email}{m.full_name?adminT("· {p0}", {p0: m.email}):''}</option>)}</select></label>{personSource&&<button type="button" className={s.secondary} onClick={()=>copyPerson(personSource)}>{adminT("Copy details again")}</button>}</>:<label className={s.field}>{adminT("Import company details")}<select value={values.source_company_id||''} onChange={e=>{const c=companies.find(c=>c.id===e.target.value);if(!c){change('source_company_id','');return;}if(!window.confirm(adminT("Copy this company’s name, trading name, registration and country into this form? Verify them before saving.")))return;setValues(v=>({...v,kind:'company',source_company_id:c.id,name:c.legal_name,trading_name:c.trading_name||'',registration_number:c.registration_number||'',country:c.country||''}));}}><option value="">{adminT("No company source")}</option>{companies.map(c=><option key={c.id} value={c.id}>{c.legal_name} · {c.registration_number||c.country||c.id.slice(0,8)}</option>)}</select></label>}
 {field('name',values.kind==='person'?'Legal name of landlord':'Official company name',200,true)}
 {(['trading_name','legal_form'] as const).map(k=>field(k,issuerFields[k][0],issuerFields[k][1]))}
 {field('registration_number','Registration number / KvK (if applicable)',100)}{field('tax_id','VAT / fiscal number (NIF/CIF, if applicable)',60)}
 {values.kind!=='person'&&<label className={s.field}>{adminT("Linked relationship")}<select value={values.relationship_id||''} onChange={e=>change('relationship_id',e.target.value)}><option value="">{adminT("No link")}</option>{relationships.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}</div>
 <p className={s.help}>{values.kind==='person'?adminT("Selecting a person copies their available name, address and contact details into this form. Bank details and invoice settings are managed here."):adminT("Companies are member-provided records.")}  {adminT("Import does not grant access or automatically synchronize later changes. Registration and tax numbers are optional where not applicable.")}</p>
 {notice&&<p className={s.notice} role="status">{adminT(notice)}</p>}
 <h3>{values.kind==='person'?adminT("Landlord address"):adminT("Registered address")}</h3>
 {savedAddress&&<><p className={s.help} style={{whiteSpace:'pre-line'}}>{adminT("Saved address:")} {savedAddress}</p><p><button type="button" className={s.secondary} onClick={()=>setUseSavedAddress(!useSavedAddress)}>{useSavedAddress?adminT("Edit address"):adminT("Keep saved address")}</button></p></>}
 <div className={s.grid}>{!useSavedAddress&&<>{(['street','house_number','address_extra','postal_code','city','region'] as const).map(k=>field(k,issuerFields[k][0],issuerFields[k][1],k==='street'||k==='city'))}{field('country','Country',120,true)}</>}{field('billing_address',issuerFields.billing_address[0],1000)}</div>
 <p className={s.help}>{useSavedAddress?adminT("Your saved address is retained until you choose to edit it."):adminT("Street, city and country are required. The full address is assembled automatically from these fields.")}  {adminT("A different billing address is optional.")}</p>
 <h3>{adminT("Contact")}</h3><div className={s.grid}>{(['contact_name','email','phone','website'] as const).map(k=>field(k,issuerFields[k][0],issuerFields[k][1],false,k==='email'?'email':k==='website'?'url':k==='phone'?'tel':'text'))}</div>
 <h3>{adminT("Bank and invoicing")}</h3><div className={s.grid}>{field('account_holder','Account holder',200)}{field('iban','IBAN',40,true)}{field('bic','BIC / SWIFT',11)}
 <label className={s.field}>{adminT("Unique invoice prefix")}<input name="prefix" value={values.prefix||''} maxLength={20} required readOnly={!!issuer} pattern={'[A-Za-z0-9][A-Za-z0-9\\-]{1,19}'} title={adminT("Use 2–20 letters, numbers or hyphens, starting with a letter or number. For example: MN.")} autoCapitalize="characters" spellCheck={false} onChange={e=>change('prefix',e.target.value.toUpperCase())} onBlur={e=>change('prefix',e.target.value.trim().toUpperCase())}/><small>{adminT("For example: MN creates invoice numbers such as MN-000001.")}</small></label>
 {field('reply_to','Invoice reply-to email (optional)',200,false,'email')}{field('payment_instructions','Default payment instructions',1000)}</div>
 <p className={s.help}>{adminT("The prefix cannot be changed after creation. Payment instructions do not change the agreed payment deadline or authorize automatic email sending.")}</p>
 <label className={s.field}>{adminT("Company logo (PNG/JPEG, up to 200 KB)")}<input type="file" accept="image/png,image/jpeg" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setError('');if(file.size>200000||!['image/png','image/jpeg'].includes(file.type)){setError('Choose a PNG or JPEG of at most 200 KB.');e.target.value='';return;}setLoadingLogo(true);try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});const image=await createImageBitmap(file);if(image.width>2000||image.height>2000){image.close();throw new Error('Use a logo no larger than 2000 × 2000 pixels.');}image.close();change('logo',data);}catch{setError('The logo could not be read. Use a PNG or JPEG up to 2000 × 2000 pixels.');}finally{setLoadingLogo(false);}}}/></label>
 {values.logo&&<><img src={values.logo} alt={adminT("Issuer logo preview")} style={{maxWidth:180,maxHeight:80,objectFit:'contain'}}/><button type="button" className={s.secondary} onClick={()=>change('logo','')}>{adminT("Remove logo")}</button></>}
 {error&&<p className={s.error} role="alert">{adminT(error)}</p>}<div className={s.toolbar}><button className={s.button}>{adminT("Save issuing entity")}</button><button type="button" className={s.secondary} onClick={close}>{adminT("Cancel")}</button></div></fieldset></form>;
}
