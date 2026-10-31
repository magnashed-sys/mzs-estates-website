'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {locales,localeDirection} from '../../../i18n/public-routing';
import {categories,formats,insightPath,publicationState,type Insight} from '../../../lib/insights/model';
import {saveInsight,type SaveState} from './actions';
import Content from '../../insights/Content';
import Cover from '../../insights/Cover';
import {insightImages} from '../../../lib/insights/images';
import s from './admin.module.css';
import articleStyle from '../../insights/insights.module.css';
function localInput(value:string){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export default function Editor({article,es}:{article:Insight & {slug_locked?:boolean};es:boolean}){
 const tr=(en:string,sp:string)=>es?sp:en,router=useRouter();
 const [state,action,pending]=useActionState<SaveState,FormData>(saveInsight,{status:'idle',message:''});
 const [title,setTitle]=useState(article.title),[summary,setSummary]=useState(article.summary),[body,setBody]=useState(article.body);
 const [coverImage,setCoverImage]=useState(article.cover_image||''),[coverAlt,setCoverAlt]=useState(article.cover_alt||'');
 const [locale,setLocale]=useState(article.locale),[status,setStatus]=useState(article.status),[preview,setPreview]=useState(false);
 const [time,setTime]=useState(''),[timezone,setTimezone]=useState(''),[dirty,setDirty]=useState(false);
 useEffect(()=>{setTime(localInput(article.publish_at||new Date().toISOString()));setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);},[article.id,article.publish_at]);
 useEffect(()=>{if(state.status==='success'){setDirty(false);if(article.revision===0)router.replace('/admin/insights/'+state.id);router.refresh();}},[state,router,article.revision]);
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
 const iso=time&&Number.isFinite(new Date(time).getTime())?new Date(time).toISOString():'';
 return <form action={action} className={s.editor} onChange={()=>setDirty(true)}>
 <input type="hidden" name="id" value={article.id}/><input type="hidden" name="article_id" value={article.article_id}/><input type="hidden" name="revision" value={state.revision??article.revision}/><input type="hidden" name="publish_at" value={iso}/>
 <section className={s.panel}><div className={s.heading}><h2>{tr('Article','Artículo')}</h2><button type="button" className={s.secondary} onClick={()=>setPreview(!preview)}>{preview?tr('Return to editor','Volver al editor'):tr('Preview text','Vista previa del texto')}</button></div>
 <div className={s.fields}><label>{tr('Language','Idioma')}<select name="locale" value={locale} onChange={e=>setLocale(e.target.value as Insight['locale'])} disabled={article.revision>0}>{locales.map(l=><option key={l} value={l}>{new Intl.DisplayNames([es?'es':'en'],{type:'language'}).of(l)}</option>)}</select>{article.revision>0&&<input type="hidden" name="locale" value={locale}/>}</label>
 <label>{tr('URL slug','URL del artículo')}<input name="slug" required maxLength={120} defaultValue={article.slug} readOnly={article.slug_locked} placeholder="buying-property-in-spain"/><small>{article.slug_locked?tr('Fixed after publication is enabled.','Fija tras activar la publicación.'):tr('Letters, numbers and hyphens. Each language has its own URL.','Letras, números y guiones. Cada idioma tiene su propia URL.')}</small></label></div>
 <div hidden={preview}>
 <label>{tr('Title','Título')}<input name="title" required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>{tr('Summary','Resumen')}<textarea name="summary" maxLength={500} rows={3} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
 <label>{tr('Article text','Texto del artículo')}<textarea name="body" maxLength={60000} rows={20} value={body} onChange={e=>setBody(e.target.value)} lang={locale} dir={localeDirection(locale)}/></label>
 <p className={s.help}>{tr('Separate paragraphs with a blank line. Use ## Heading, ### Subheading and - for lists. Add public source links below. HTML is displayed as text.','Separe los párrafos con una línea en blanco. Use ## Título, ### Subtítulo y - para listas. Añada enlaces públicos a las fuentes debajo. El HTML se muestra como texto.')}</p>
 </div>
 {preview&&<section className={articleStyle.article} lang={locale} dir={localeDirection(locale)} aria-label={tr('Draft preview','Vista previa del borrador')}><h1>{title}</h1><p className={articleStyle.lead}>{summary}</p><Cover src={coverImage} alt={coverAlt}/><div className={articleStyle.prose}><Content body={body}/></div></section>}
 </section>
 <section className={s.panel}><h2>{tr('Main image','Imagen principal')}</h2>
 <label>{tr('Image','Imagen')}<select name="cover_image" value={coverImage} onChange={e=>setCoverImage(e.target.value)}><option value="">{tr('No image','Sin imagen')}</option>{insightImages.map(image=><option key={image.src} value={image.src}>{es?image.es:image.en}</option>)}</select></label>
 <label>{tr('Image description for accessibility','Descripción de la imagen para accesibilidad')}<input name="cover_alt" value={coverAlt} onChange={e=>setCoverAlt(e.target.value)} maxLength={300} required={!!coverImage}/></label>
 <small>{tr('Describe the image in the language of this article. This is used as alternative text, not as a visible caption.','Describa la imagen en el idioma del artículo. Se utiliza como texto alternativo, no como pie de foto visible.')}</small>
 {coverImage&&<Cover src={coverImage} alt={coverAlt}/>}
 </section>
 <section className={s.panel}><h2>{tr('Classification & attribution','Clasificación y autoría')}</h2><div className={s.fields}>
 <label>{tr('Subject / related service','Tema / servicio relacionado')}<select name="category" defaultValue={article.category}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
 <label>{tr('Format','Formato')}<select name="format" defaultValue={article.format}>{formats.map(c=><option key={c}>{c}</option>)}</select></label>
 <label>{tr('Region','Región')}<input name="region" maxLength={80} defaultValue={article.region} placeholder="Costa Blanca"/></label>
 <label>{tr('Author','Autor')}<input name="author" maxLength={120} defaultValue={article.author}/></label>
 <label>{tr('Content last reviewed','Última revisión del contenido')}<input name="content_updated_on" type="date" required defaultValue={article.content_updated_on}/></label>
 </div><label>{tr('Public sources · one HTTPS URL per line','Fuentes públicas · una URL HTTPS por línea')}<textarea name="sources" rows={3} maxLength={6000} defaultValue={article.sources.join('\n')}/></label>
 <small>{tr('Do not include private documents, signed download links or confidential project information.','No incluya documentos privados, enlaces de descarga firmados ni información confidencial de proyectos.')}</small></section>
 <section className={s.panel}><h2>{tr('Search & sharing','Búsqueda y redes')}</h2>
 <label>{tr('SEO title · optional','Título SEO · opcional')}<input name="seo_title" maxLength={180} defaultValue={article.seo_title}/></label>
 <label>{tr('SEO description · optional','Descripción SEO · opcional')}<textarea name="seo_description" maxLength={320} rows={3} defaultValue={article.seo_description}/></label>
 <p className={s.help}>{tr('The title and summary are used when these fields are empty. Published versions can be indexed by search engines and are included in the sitemap. Drafts, future publications and archives are excluded.','Si están vacíos, se usan el título y el resumen. Las versiones publicadas pueden ser indexadas por los buscadores y se incluyen en el sitemap. Se excluyen los borradores, las publicaciones futuras y los archivos.')}</p></section>
 <section className={s.panel}><h2>{tr('Publication','Publicación')}</h2><div className={s.fields}>
 <label>{tr('Status','Estado')}<select name="status" value={status} onChange={e=>setStatus(e.target.value as Insight['status'])}><option value="draft">{tr('Draft · private','Borrador · privado')}</option><option value="published">{tr('Published / scheduled','Publicado / programado')}</option><option value="archived">{tr('Archived · private','Archivado · privado')}</option></select></label>
 <label>{tr('Publication time','Fecha y hora de publicación')}<input type="datetime-local" value={time} onChange={e=>setTime(e.target.value)} required={status==='published'}/><small>{timezone?tr('Your timezone: ','Su zona horaria: ')+timezone:tr('Loading local time…','Cargando hora local…')}</small></label></div>
 <p className={s.help}>{tr('Published versions become accessible by direct URL at the selected time. Drafts, scheduled versions and archived versions are not visible to visitors. Saving changes to a published version updates it immediately.','Las versiones publicadas son accesibles por URL directa a la hora elegida. Los visitantes no pueden ver borradores, versiones programadas ni archivadas. Guardar una versión publicada la actualiza de inmediato.')}</p>
 <div className={s.actions}><button disabled={pending||!timezone}>{pending?tr('Saving…','Guardando…'):tr('Save article','Guardar artículo')}</button>{article.revision>0&&publicationState(article)==='published'&&<a href={insightPath(article.locale,article.slug)} target="_blank" rel="noopener noreferrer">{tr('Open published version ↗','Abrir versión publicada ↗')}</a>}</div>
 {state.message&&<p role={state.status==='error'?'alert':'status'} className={state.status==='error'?s.error:s.success}>{state.status==='success'?tr('Saved successfully.','Guardado correctamente.'):state.message}</p>}
 </section></form>;
}
