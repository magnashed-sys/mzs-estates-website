import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {archiveLanguage} from '../../../../../../lib/accountancy/archive-data';
import {ARCHIVE_ROOT,copy,categoryLabels,statusLabels,uuid,type ArchiveDocument} from '../../../../../../lib/accountancy/archive';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import {ReviewForm} from '../Forms';
import s from '../archive.module.css';
export const dynamic='force-dynamic';
type Event={id:string;actor_id:string|null;occurred_at:string;event_type:string;after_data:ArchiveDocument};
export default async function Document({params}:{params:Promise<{id:string}>}){
 const {db,user}=await requireEstateAdmin(),{id}=await params;if(!uuid.test(id))notFound();
 const [result,language,events]=await Promise.all([
  db.from('mzs_accountancy_documents').select('*').eq('id',id).maybeSingle(),archiveLanguage(db,user.id),
  allRows<Event>((a,b)=>db.from('mzs_accountancy_document_events').select('id,actor_id,occurred_at,event_type,after_data',{count:'exact'}).eq('document_id',id).order('occurred_at',{ascending:false}).order('id').range(a,b))
 ]);
 if(result.error)throw Error('Document unavailable');if(!result.data)notFound();const d=result.data as ArchiveDocument,t=copy[language];
 const entity=await db.from('mzs_lease_issuers').select('name,tax_id').eq('id',d.issuer_id).single();if(entity.error)throw Error('Entity unavailable');
 const actors=[...new Set(events.map(e=>e.actor_id).filter((x):x is string=>Boolean(x)))];
 const people=actors.length?await db.from('profiles').select('id,full_name').in('id',actors):{data:[],error:null};if(people.error)throw Error('History unavailable');
 const names=new Map((people.data??[]).map(p=>[p.id,p.full_name]));
 const dateTime=(value:string)=>new Intl.DateTimeFormat(language==='es'?'es-ES':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(value));
 return <section lang={language} className={s.page}><Link href={ARCHIVE_ROOT+'?entity='+d.issuer_id+'&year='+d.fiscal_year}>← {t.title}</Link>
  <header className={s.heading}><div><h1>{d.title}</h1><p>{entity.data.name} · {entity.data.tax_id} · {d.fiscal_year}</p></div><span className={s.badge}>{statusLabels[language][d.review_status]}</span></header>
  <div className={s.links}><a className={s.button} href={ARCHIVE_ROOT+'/'+id+'/file'} target="_blank" rel="noopener noreferrer">{t.open} ↗</a><a className={s.button} href={ARCHIVE_ROOT+'/'+id+'/file?download=1'} target="_blank" rel="noopener noreferrer">{t.download}</a></div>
  <dl className={s.meta}><div><dt>{t.original}</dt><dd>{d.original_name}</dd></div><div><dt>{t.fileSize}</dt><dd>{new Intl.NumberFormat(language).format(d.file_size_bytes)} bytes</dd></div><div><dt>{t.created}</dt><dd>{dateTime(d.created_at)}</dd></div><div><dt>{t.updated}</dt><dd>{dateTime(d.updated_at)}</dd></div></dl>
  <p className={s.notice}>{t.reference}</p><p className={s.note}>{t.source}</p>
  <ReviewForm key={d.id+':'+d.revision} document={d} language={language}/>
  <section className={s.panel}><h2>{t.history}</h2><p className={s.note}>{t.auditNote}</p>{events.map(event=><details className={s.event} key={event.id}>
   <summary>{dateTime(event.occurred_at)} · {event.event_type==='created'?t.created:t.updated} · {event.actor_id?(names.get(event.actor_id)||event.actor_id):t.system}</summary>
   <p>{t.revision}: {event.after_data.revision}<br/>{event.after_data.title}<br/>{categoryLabels[language][event.after_data.category]} · {statusLabels[language][event.after_data.review_status]}<br/>{event.after_data.document_date??'—'} · {event.after_data.period_label}</p><p>{event.after_data.notes||'—'}</p>
  </details>)}</section>
 </section>;
}
