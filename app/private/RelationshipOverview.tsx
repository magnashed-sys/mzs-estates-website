'use client';
import {useEffect,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {createClient} from '../../lib/supabase/client';
import s from './relationship-overview.module.css';

type Overview={companies:{id:string;name:string;address:string}[];contracts:{id:string;title:string;status:string;lease_start:string;lease_end:string|null;tenant_name:string;issuer_name:string;units:string[];invoices:{id:string;number:string;issued_on:string;due_date:string;total:number;outstanding:number}[]}[]};
export default function RelationshipOverview(){
 const t=useTranslations('RentalAccount');const locale=useLocale();
 const [data,setData]=useState<Overview|null>(null);const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let current=true;setError(false);setData(null);void(async()=>{try{const result=await createClient().rpc('mzs_member_relationship_overview');if(result.error||!result.data||!Array.isArray(result.data.companies)||!Array.isArray(result.data.contracts))throw new Error();if(current)setData(result.data);}catch{if(current)setError(true);}})();return()=>{current=false;};},[attempt]);
 if(error)return <section className={s.section}><p role="alert">{t('error')}</p><button onClick={()=>setAttempt(value=>value+1)}>{t('retry')}</button></section>;
 if(!data || (!data.companies.length&&!data.contracts.length))return null;
 const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(value);
 return <section className={s.section} aria-labelledby="relationship-overview-title"><h2 id="relationship-overview-title">{t('title')}</h2><p>{t('intro')}</p>
  {data.companies.length>0&&<><h3>{t('companies')}</h3><div className={s.grid}>{data.companies.map(company=><article className={s.card} key={company.id}><h4>{company.name}</h4><p className={s.address}>{company.address}</p></article>)}</div></>}
  {data.contracts.length>0&&<><h3>{t('contracts')}</h3>{data.contracts.map(contract=><article key={contract.id} className={s.card}><h4>{contract.title}</h4><p>{contract.tenant_name} · {contract.units.join(', ')}</p><dl><div><dt>{t('period')}</dt><dd>{date(contract.lease_start)} — {contract.lease_end?date(contract.lease_end):t('ongoing')}</dd></div><div><dt>{t('landlord')}</dt><dd>{contract.issuer_name}</dd></div><div><dt>{t('status')}</dt><dd>{contract.status==='active'?t('active'):t('stopped')}</dd></div></dl>
    <h5>{t('invoices')}</h5>{contract.invoices.length?<div className={s.tableWrap}><table><thead><tr><th>{t('number')}</th><th>{t('due')}</th><th>{t('total')}</th><th>{t('outstanding')}</th></tr></thead><tbody>{contract.invoices.map(invoice=><tr key={invoice.id}><td>{invoice.number}</td><td>{date(invoice.due_date)}</td><td>{money(invoice.total)}</td><td>{money(invoice.outstanding)}</td></tr>)}</tbody></table></div>:<p>{t('noInvoices')}</p>}
  </article>)}</>}
 </section>;
}
