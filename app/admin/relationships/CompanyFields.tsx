'use client';
import {useAdminI18n} from '../../../lib/admin/i18n';

import CountrySelect from '../../components/CountrySelect';
import {addressFields, companyFields, relationshipDelivery, type CompanyDetails, type RelationshipRecord} from '../../../lib/relationships/model';
import s from '../group/estates/contracts/contracts.module.css';

export default function CompanyFields({record,onChange,section}:{record:Omit<RelationshipRecord,'id'|'version'>;onChange:(details:CompanyDetails)=>void;section:'identity'|'delivery'}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const details=record.company_details || {};
  function field(key:keyof typeof companyFields) {
    const [label,max]=companyFields[key];
    return <label className={s.field} key={key}><span>{adminT(label)}  {adminT("(optional)")}</span><input type={key.endsWith('_email')?'email':key==='website'?'url':'text'} maxLength={max} value={details[key] || ''} onChange={e=>onChange({...details,[key]:e.target.value})}/></label>;
  }
  if(section==='identity')return <div className={s.wide}><h3>{adminT("Company details (optional)")}</h3><div className={s.grid}>{(['trading_name','registration_number','tax_id','attention','website'] as const).map(field)}</div></div>;
  return <div className={s.wide}>
    <p className={s.help}>{adminT("Leave these fields empty to use the main address, general email and contact person. Enter an alternative address as a complete address; it replaces the main address.")}</p>
    {(['invoice','correspondence'] as const).map(purpose=>{
      const addressKey=`${purpose}_address` as const, attentionKey=`${purpose}_attention` as const, emailKey=`${purpose}_email` as const;
      const delivery=relationshipDelivery({...record,id:'',version:0},purpose);
      const hasDetails=!!(details[attentionKey]||details[emailKey]||Object.values(details[addressKey]||{}).some(Boolean));
      return <details key={purpose} className={s.panel}><summary>{purpose==='invoice'?adminT("Different invoice details"):adminT("Different correspondence details")}  {adminT("(optional)")}{hasDetails?adminT(" · entered"):''}</summary>
        <div className={s.grid}>{field(attentionKey)}{field(emailKey)}
          {Object.entries(addressFields).map(([key,[label,max,autoComplete]])=><label className={s.field} key={key}><span>{purpose==='invoice'?adminT("Invoice"):adminT("Correspondence")} {adminT(label.toLowerCase())}</span>{key==='country'?<CountrySelect value={details[addressKey]?.country || ''} onChange={value=>onChange({...details,[addressKey]:{...details[addressKey],country:value}})}/>:<input maxLength={max} autoComplete={autoComplete==='off'?'off':`section-${purpose} ${autoComplete}`} value={details[addressKey]?.[key as keyof typeof addressFields] || ''} onChange={e=>onChange({...details,[addressKey]:{...details[addressKey],[key]:e.target.value}})}/>}</label>)}
        </div>
        <p className={s.label}>{purpose==='invoice'?adminT("Invoice recipient preview"):adminT("Correspondence recipient preview")}</p>
        <p className={s.preview} style={{whiteSpace:'pre-line'}}>{[record.name,delivery.attention&&`Attn: ${delivery.attention}`,delivery.address,delivery.email].filter(Boolean).join('\n') || adminT("No details supplied.")}</p>
        {hasDetails&&<button className={s.secondary} type="button" onClick={()=>onChange({...details,[attentionKey]:'',[emailKey]:'',[addressKey]:{}})}>{adminT("Use general details for")} {purpose==='invoice'?adminT("invoices"):adminT("correspondence")}</button>}
      </details>;
    })}
  </div>;
}
