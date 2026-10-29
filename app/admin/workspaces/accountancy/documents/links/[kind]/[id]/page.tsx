import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../../../lib/security/estate-properties';
import {archiveEntities,archiveLanguage} from '../../../../../../../../lib/accountancy/archive-data';
import {ARCHIVE_ROOT,uuid,type ArchiveDocument} from '../../../../../../../../lib/accountancy/archive';
import {documentLinks} from '../../../../../../../../lib/accountancy/document-links-data';
import {attachmentCopy,linkTarget} from '../../../../../../../../lib/accountancy/document-links';
import {allRows} from '../../../../../../../../lib/property-operations/staff-data';
import {UploadForm} from '../../../Forms';
import {LinkForm} from '../../LinkForm';
import s from '../../../archive.module.css';
export const dynamic='force-dynamic';
export default async function Attachments({params,searchParams}:{params:Promise<{kind:string;id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db,user}=await requireEstateAdmin(),p=await params,q=await searchParams;
 let target;try{target=linkTarget(p.kind,p.id);}catch{notFound();}
 const [language,entities,links]=await Promise.all([archiveLanguage(db,user.id),archiveEntities(db),documentLinks(db,target.kind,[target.id])]);
 const t=attachmentCopy[language];let title='',back='',entity='',year=new Date().getUTCFullYear(),choices=entities;
 if(target.kind==='cost'){
  const result=await db.from('mzs_ops_expense_drafts').select('supplier_invoice_number,description,legal_entity_id,invoice_date').eq('id',target.id).maybeSingle();
  if(result.error)throw Error('Invoice unavailable');if(!result.data)notFound();
  const c=result.data;title=c.supplier_invoice_number+' · '+c.description;entity=c.legal_entity_id;year=Number(c.invoice_date.slice(0,4));
  const annual=await db.from('mzs_accountancy_years').select('id').eq('issuer_id',entity).eq('fiscal_year',year).maybeSingle();if(annual.error)throw Error('Year unavailable');
  back=annual.data?'/admin/workspaces/accountancy/administrations/'+annual.data.id+'#costs':'/admin/workspaces/accountancy/administrations';choices=entities.filter(e=>e.id===entity);
 }else{
  const property=await db.from('mzs_estate_properties').select('name,ownership_since_year').eq('id',target.id).maybeSingle();if(property.error)throw Error('Property unavailable');if(!property.data)notFound();title=property.data.name;
  const associations=await allRows<{legal_entity_id:string}>((a,b)=>db.from('mzs_ops_property_entity_links').select('legal_entity_id',{count:'exact'}).eq('property_id',target.id).order('id').range(a,b));
  choices=entities.filter(e=>associations.some(a=>a.legal_entity_id===e.id));entity=typeof q.entity==='string'&&uuid.test(q.entity)&&choices.some(e=>e.id===q.entity)?q.entity:choices[0]?.id??'';
  year=typeof q.year==='string'&&/^(19|20|21)\d{2}$/.test(q.year)?Number(q.year):property.data.ownership_since_year??year;back='/admin/group/estates/properties/'+target.id;
 }
 const page=typeof q.page==='string'&&/^[1-9]\d{0,4}$/.test(q.page)?Number(q.page):1;
 const pageHref=(n:number)=>'?'+new URLSearchParams({entity,year:String(year),page:String(n)});
 const available=entity?await db.from('mzs_accountancy_documents').select('*',{count:'exact'}).eq('issuer_id',entity).eq('fiscal_year',year).neq('review_status','superseded').order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1):{data:[],error:null,count:0};
 if(available.error)throw Error('Document archive unavailable');const pages=Math.max(1,Math.ceil((available.count??0)/25));if(page>pages)redirect(pageHref(pages));const active=links.filter(l=>l.is_active),history=links.filter(l=>!l.is_active);
 return <section lang={language} className={s.page}><Link href={back}>← {t.back}</Link><h1>{t.title}</h1><h2>{title}</h2><p>{t.intro}</p>
 <section className={s.panel}><h2>{t.linked}</h2>{!active.length&&<p>{t.empty}</p>}{active.map(l=><div key={l.id}><a href={ARCHIVE_ROOT+'/'+l.document_id+'/file'} target="_blank" rel="noopener noreferrer">{l.document.title} ↗</a><p>{l.document.original_name} · {l.document.fiscal_year}</p>{l.document.review_status==='superseded'&&<p role="status">{t.superseded}</p>}<LinkForm kind={target.kind} targetId={target.id} documentId={l.document_id} linkId={l.id} language={language}/></div>)}</section>
 {target.kind==='property'&&<form method="get" className={s.filters}><label>{t.select}<select name="entity" defaultValue={entity}>{choices.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><input aria-label={language==='es'?'Ejercicio':'Financial year'} name="year" type="number" min={1900} max={2199} required defaultValue={year}/><button className={s.button}>{t.filter}</button></form>}
 {entity&&<><h2>{t.upload}</h2><UploadForm key={entity+year} entities={choices} language={language} entity={entity} year={year} fixedContext/><h2>{t.choose}</h2><p>{entities.find(e=>e.id===entity)?.name} · {year}</p></>}
 {!available.data?.some(d=>!active.some(l=>l.document_id===d.id))&&<p>{t.none}</p>}
 {(available.data as ArchiveDocument[]??[]).filter(d=>!active.some(l=>l.document_id===d.id)).map(d=><section key={d.id} className={s.panel}><Link href={ARCHIVE_ROOT+'/'+d.id}>{d.title}</Link><p>{d.original_name}</p><a href={ARCHIVE_ROOT+'/'+d.id+'/file'} target="_blank" rel="noopener noreferrer">{language==='es'?'Abrir PDF':'Open PDF'} ↗</a><LinkForm kind={target.kind} targetId={target.id} documentId={d.id} language={language}/></section>)}
 <nav className={s.pagination}>{page>1&&<Link href={pageHref(page-1)}>{language==='es'?'Anterior':'Previous'}</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={pageHref(page+1)}>{language==='es'?'Siguiente':'Next'}</Link>}</nav>
 {!!history.length&&<details className={s.panel}><summary>{t.history}</summary>{history.map(l=><p key={l.id}>{l.document.title} · {t.removed} · {l.removed_at?.slice(0,10)}<br/>{l.removal_reason}</p>)}</details>}
 </section>;
}
