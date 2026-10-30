import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {locales} from '../../../../i18n/public-routing';
import type {Insight} from '../../../../lib/insights/model';
import Editor from '../Editor';
import s from '../admin.module.css';
export default async function EditInsight({params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin();const [{id},{language}]=await Promise.all([params,getAdminI18n()]);const es=language==='es';
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {data,error}=await db.from('mzs_insights').select('*').eq('id',id).maybeSingle();
 if(error)throw new Error('The article could not be loaded.');if(!data)notFound();
 const [versions,audit]=await Promise.all([
  db.from('mzs_insights').select('id,locale,status').eq('article_id',data.article_id),
  db.from('mzs_insights_audit').select('id,changed_at,after_data->revision,after_data->status').eq('insight_id',id).order('changed_at',{ascending:false}).limit(10),
 ]);
 if(versions.error||audit.error)throw new Error('Article history could not be loaded.');
 return <main className={s.page}><Link href="/admin/insights">← MZS Insights</Link><h1>{es?'Editar artículo':'Edit article'}</h1>
 <details className={s.panel}><summary>{es?'Versiones de idioma':'Language versions'} ({versions.data.length}/24)</summary><nav className={s.languages}>{locales.map(locale=>{const version=versions.data.find(v=>v.locale===locale);return <Link aria-current={version?.id===id?'page':undefined} key={locale} href={version?'/admin/insights/'+version.id:'/admin/insights/new?'+new URLSearchParams({article:data.article_id,locale})}>{locale} {version?'✓':'+'}</Link>})}</nav></details>
 <Editor article={data as Insight} es={es}/>
 <details className={s.panel}><summary>{es?'Historial · últimos 10 cambios':'History · latest 10 changes'}</summary><ul>{audit.data.map(a=><li key={a.id}>{new Intl.DateTimeFormat(es?'es':'en',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(a.changed_at))} (Madrid) · #{String(a.revision)} · {String(a.status)}</li>)}</ul></details></main>;
}
