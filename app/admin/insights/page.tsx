import Link from 'next/link';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import {isLocale,locales} from '../../../i18n/public-routing';
import {publicationState,type Insight} from '../../../lib/insights/model';
import s from './admin.module.css';
export default async function InsightsAdmin({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {db}=await requireEstateAdmin();const [{language},q]=await Promise.all([getAdminI18n(),searchParams]);const es=language==='es',tr=(en:string,sp:string)=>es?sp:en;
 const locale=isLocale(q.locale)?q.locale:'',status=['draft','published','archived'].includes(q.status||'')?q.status!:'';
 const page=/^\d+$/.test(q.page||'')?Math.min(10000,Math.max(1,Number(q.page))):1;
 let query=db.from('mzs_insights').select('id,article_id,title,locale,status,publish_at,updated_at,revision,category',{count:'exact'});
 if(locale)query=query.eq('locale',locale);if(status)query=query.eq('status',status);
 const {data,error,count}=await query.order('updated_at',{ascending:false}).order('id').range((page-1)*30,page*30-1);
 if(error)throw new Error('Insights could not be loaded.');
 const href=(p:number)=>'/admin/insights?'+new URLSearchParams({locale,status,page:String(p)});
 return <main className={s.page}><Link href="/admin">← {tr('Administration','Administración')}</Link>
 <header className={s.heading}><div><p className={s.eyebrow}>CONTENT STUDIO</p><h1>MZS Insights</h1><p>{tr('Articles, guides and cases · publication per language.','Artículos, guías y casos · publicación por idioma.')}</p></div><Link className={s.primary} href="/admin/insights/new">+ {tr('New article','Nuevo artículo')}</Link></header>
 <p className={s.notice}>{tr('Soft launch: no links in the public menus, homepage or sitemap. Search indexing is disabled. You can prepare drafts and review published versions by direct URL.','Fase inicial: sin enlaces en menús públicos, inicio o sitemap. La indexación está desactivada. Puede preparar borradores y revisar publicaciones por URL directa.')}</p>
 <form className={s.filters}><label>{tr('Language','Idioma')}<select name="locale" defaultValue={locale}><option value="">{tr('All languages','Todos los idiomas')}</option>{locales.map(l=><option key={l}>{l}</option>)}</select></label><label>{tr('Status','Estado')}<select name="status" defaultValue={status}><option value="">{tr('All statuses','Todos los estados')}</option><option value="draft">{tr('Draft','Borrador')}</option><option value="published">{tr('Published / scheduled','Publicado / programado')}</option><option value="archived">{tr('Archived','Archivado')}</option></select></label><button>{tr('Filter','Filtrar')}</button></form>
 <p className={s.help}>{count||0} {tr('language versions','versiones de idioma')}</p>
 <div className={s.list}>{(data||[]).map(row=><article className={s.row} key={row.id}><div><p className={s.eyebrow}>{row.locale} / {row.category}</p><h2><Link href={'/admin/insights/'+row.id}>{row.title}</Link></h2><p>{({draft:tr('Draft','Borrador'),published:tr('Published','Publicado'),scheduled:tr('Scheduled','Programado'),archived:tr('Archived','Archivado')})[publicationState(row as Insight)]}{row.publish_at&&<> · <time>{new Intl.DateTimeFormat(es?'es':'en',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(row.publish_at))} (Madrid)</time></>}</p></div><Link href={'/admin/insights/'+row.id}>{tr('Edit & translations →','Editar y traducir →')}</Link></article>)}</div>
 {!data?.length&&<div className={s.panel}><h2>{tr('Ready for your first insight','Todo listo para su primer artículo')}</h2><p>{tr('Create an article, choose its language and save it as a draft. Add other language versions when they are ready.','Cree un artículo, elija el idioma y guárdelo como borrador. Añada otras versiones cuando estén listas.')}</p></div>}
 <nav className={s.actions}>{page>1&&<Link href={href(page-1)}>{tr('Previous','Anterior')}</Link>}{page*30<(count||0)&&<Link href={href(page+1)}>{tr('Next','Siguiente')}</Link>}</nav>
 </main>;
}
