import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {archiveEntities,archiveLanguage,archiveRows} from '../../../../../lib/accountancy/archive-data';
import {ARCHIVE_ROOT,PAGE_SIZE,archiveFilters,archiveHref,categories,categoryLabels,copy,statuses,statusLabels} from '../../../../../lib/accountancy/archive';
import {setArchiveLanguage} from './actions';
import {UploadForm} from './Forms';
import s from './archive.module.css';
export const dynamic='force-dynamic';
export default async function Documents({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db,user}=await requireEstateAdmin();
 const [language,entities,params]=await Promise.all([archiveLanguage(db,user.id),archiveEntities(db),searchParams]);const t=copy[language];
 let f;try{f=archiveFilters(params);}catch{return <section lang={language} className={s.page}><h1>{t.invalidFilters}</h1><Link href={ARCHIVE_ROOT}>{t.clear}</Link></section>;}
 const {rows,count}=await archiveRows(db,f);const pages=Math.max(1,Math.ceil(count/PAGE_SIZE));
 if(f.page>pages)redirect(archiveHref(f,pages));const names=new Map(entities.map(e=>[e.id,e]));
 return <section lang={language} className={s.page}>
  <Link href="/admin/workspaces/accountancy">← {t.back}</Link>
  <header className={s.heading}><div><h1>{t.title}</h1><p>{t.intro}</p></div>
   <form action={setArchiveLanguage} className={s.language}><label>{t.language}<select name="language" defaultValue={language}><option value="en">English</option><option value="es">Español</option></select></label><button className={s.button}>{t.languageSave}</button></form>
  </header>
  <form method="get" className={s.filters}>
   <label>{t.entity}<select name="entity" defaultValue={f.entity}><option value="all">{t.all}</option>{entities.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
   <label>{t.year}<input name="year" type="number" min={1900} max={2199} step={1} placeholder={t.all} defaultValue={f.year==='all'?'':f.year}/></label>
   <label>{t.category}<select name="category" defaultValue={f.category}><option value="all">{t.all}</option>{categories.map(c=><option key={c} value={c}>{categoryLabels[language][c]}</option>)}</select></label>
   <label>{t.status}<select name="status" defaultValue={f.status}><option value="all">{t.all}</option>{statuses.map(c=><option key={c} value={c}>{statusLabels[language][c]}</option>)}</select></label>
   <label>{t.search}<input name="q" maxLength={160} defaultValue={f.q}/></label><button className={s.button}>{t.filter}</button><Link href={ARCHIVE_ROOT}>{t.clear}</Link>
  </form>
  <p>{count} {t.count}</p>
  <div className={s.tableWrap}><table className={s.table}><thead><tr><th>{t.documentTitle}</th><th>{t.entity} / {t.year}</th><th>{t.category}</th><th>{t.status}</th><th>{t.date}</th></tr></thead><tbody>
   {rows.map(d=><tr key={d.id}><td><Link href={ARCHIVE_ROOT+'/'+d.id}>{d.title}</Link><small>{d.original_name}</small><div className={s.links}><a href={ARCHIVE_ROOT+'/'+d.id+'/file'} target="_blank" rel="noopener noreferrer">{t.open} ↗</a><Link href={ARCHIVE_ROOT+'/'+d.id}>{t.details}</Link></div></td>
    <td>{names.get(d.issuer_id)?.name??d.issuer_id}<small>{d.fiscal_year}{d.period_label?' · '+d.period_label:''}</small></td><td>{categoryLabels[language][d.category]}</td>
    <td><span className={s.badge+' '+(d.review_status==='needs_attention'?s.attention:'')}>{statusLabels[language][d.review_status]}</span></td><td>{d.document_date?new Intl.DateTimeFormat(language==='es'?'es-ES':'en-GB',{timeZone:'UTC'}).format(new Date(d.document_date+'T12:00:00Z')):'—'}</td></tr>)}
   {!rows.length&&<tr><td className={s.empty} colSpan={5}>{t.empty}</td></tr>}
  </tbody></table></div>
  <nav className={s.pagination} aria-label={t.page}>{f.page>1&&<Link href={archiveHref(f,f.page-1)}>{t.previous}</Link>}<span>{t.page} {f.page} / {pages}</span>{f.page<pages&&<Link href={archiveHref(f,f.page+1)}>{t.next}</Link>}</nav>
  <p className={s.notice}>{t.reference}</p>
  <UploadForm entities={entities} language={language} entity={f.entity} year={f.year==='all'?new Date().getUTCFullYear():Number(f.year)}/>
 </section>;
}
