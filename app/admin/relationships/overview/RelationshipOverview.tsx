'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useAdminI18n} from '../../../../lib/admin/i18n';
import {overviewText,type OverviewSection} from '../../../../lib/relationships/overview';
import s from '../../workspaces/accountancy/administrations/administration.module.css';
function Section({section,query,language}:{section:OverviewSection;query:string;language:string}){
 const [page,setPage]=useState(1),{t:adminT}=useAdminI18n();const t=(key:string)=>overviewText(language,key);
 const rows=section.items.filter(i=>[i.title,i.detail,i.date,t(i.status??''),t(i.basis)].join(' ').toLocaleLowerCase().includes(query));
 const pages=Math.max(1,Math.ceil(rows.length/10)),current=Math.min(page,pages);
 return <section className={s.panel} id={section.id} aria-labelledby={'heading-'+section.id}>
 <h2 id={'heading-'+section.id}>{t(section.id)} {section.unavailable?'':`(${rows.length}${query?' / '+section.items.length:''})`}</h2>
 {section.unavailable?<p role="alert">{t('unavailable')}</p>:<>
 {!rows.length&&<p>{query?(language==='es'?'No hay resultados para esta búsqueda.':'No results for this search.'):t('empty')}</p>}
 <div className={s.cards}>{rows.slice((current-1)*10,current*10).map(item=><article className={s.notice} key={item.id}>
 <h3><Link href={item.href}>{item.title}</Link></h3>{item.detail&&<p>{item.detail}</p>}
 <p>{item.date&&<time dateTime={item.date}>{item.date} · </time>}{item.status&&<span className={s.badge}>{adminT(t(item.status))}</span>}</p>
 <small>{t(item.basis)}</small><p><Link href={item.href}>{t('open')}</Link></p>
 </article>)}</div>
 {pages>1&&<nav className={s.pagination} aria-label={t(section.id)}><button className={s.button} disabled={current===1} onClick={()=>setPage(current-1)}>{t('previous')}</button><span>{current}/{pages}</span><button className={s.button} disabled={current===pages} onClick={()=>setPage(current+1)}>{t('next')}</button></nav>}
 </>}
 </section>;
}
export default function RelationshipOverview({sections,language}:{sections:OverviewSection[];language:string}){
 const [query,setQuery]=useState(''),t=(key:string)=>overviewText(language,key);const search=query.trim().toLocaleLowerCase();
 return <>
 <nav className={s.cards} aria-label="Relationship 360°">{sections.map(section=><Link key={section.id} className={s.card} href={'#'+section.id}>{t(section.id)}<strong>{section.unavailable?'—':section.items.length}</strong></Link>)}</nav>
 <div className={s.filters}><label htmlFor="relationship-overview-search">{t('search')}</label><input id="relationship-overview-search" type="search" value={query} maxLength={150} onChange={e=>setQuery(e.target.value)} onInput={e=>setQuery(e.currentTarget.value)}/>{query&&<button className={s.button} type="button" onClick={()=>setQuery('')}>{language==='es'?'Borrar búsqueda':'Clear search'}</button>}</div>
 {sections.map(section=><Section key={section.id+':'+search} section={section} query={search} language={language}/>)}
 </>;
}
