import {attachmentHref} from '../../../../../../lib/accountancy/document-links';
import {ARCHIVE_ROOT} from '../../../../../../lib/accountancy/archive';
import {purchaseWorkspaceEnvironment,PDF_ROOT} from '../../../../../../lib/accountancy/pdf/model';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import {annualSource} from '../../../../../../lib/accountancy/administration-data';
import {annualEvidenceReadiness,type EvidenceIssue} from '../../../../../../lib/accountancy/annual-evidence';
import {supplierCostIntegrity} from '../../../../../../lib/accountancy/supplier-integrity';
import {ADMINISTRATION_ROOT,uuid,costCategories,annualCategory,annualSummary} from '../../../../../../lib/accountancy/administration';
import {YearForm,ProjectForm,CostForm,CostReviewForm} from '../Forms';
import s from '../administration.module.css';
export const dynamic='force-dynamic';
export default async function Administration({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db}=await requireEstateAdmin(),{t,locale,language}=await getAdminI18n(),{id}=await params;if(!uuid.test(id))notFound();
 const exists=await db.from('mzs_accountancy_years').select('id').eq('id',id).maybeSingle();if(exists.error)throw Error('Administration unavailable');if(!exists.data)notFound();
 const [source,properties,suppliers,q]=await Promise.all([annualSource(db,id),allRows<{id:string;name:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('name').order('id').range(a,b)),allRows<{id:string;name:string;kind:string;company_details:unknown}>((a,b)=>db.from('mzs_lease_relationships').select('id,name,kind,company_details',{count:'exact'}).order('name').order('id').range(a,b)),searchParams]);
 const y=source.administration,summary=annualSummary(source),evidence=annualEvidenceReadiness(source),supplierIntegrity=supplierCostIntegrity(source.costs,suppliers),root=ADMINISTRATION_ROOT+'/'+id,money=(c:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(c/100),reviews=new Map(source.reviews.map(r=>[r.draft_id,r]));
 const l=(en:string,es:string)=>language==='es'?es:en;
 const issueName:Record<EvidenceIssue,string>={missing_original:l('Original PDF missing','Falta el PDF original'),cost_pending_review:l('Cost awaiting review','Coste pendiente de revisión'),archive_pending_review:l('Archived PDF awaiting review','PDF archivado pendiente de revisión')};
 const sourceName={private_archive:l('Private archive','Archivo privado'),isolated_purchase_pdf:l('Isolated PDF intake','Recepción aislada de PDF'),not_retained:l('Not retained','No archivado')};
 const status=typeof q.status==='string'&&['pending','reviewed','excluded'].includes(q.status)?q.status:'all',category=typeof q.category==='string'&&q.category in costCategories?q.category:'all';
 const costs=source.costs.filter(c=>(status==='all'||(reviews.get(c.id)?.review_status??'pending')===status)&&(category==='all'||(reviews.get(c.id)?.category??annualCategory(c.category))===category));
 const pages=Math.max(1,Math.ceil(costs.length/25)),page=Math.min(pages,typeof q.page==='string'&&/^[1-9]\d{0,5}$/.test(q.page)?Number(q.page):1),href=(n:number)=>root+'?'+new URLSearchParams({status,category,page:String(n)})+'#costs';
 return <section className={s.page}><Link href={ADMINISTRATION_ROOT}>← {t('Year administrations')}</Link><header className={s.heading}><div><h1>{source.sales.issuer.name} · {y.fiscal_year}</h1><p>{t(y.purpose==='reference'?'Historical reference':'Current administration')}</p></div><a className={s.button} href={root+'/export'}>{t('Download accountant year package')}</a></header>
 <div className={s.metrics}><p>{t('Reviewed costs')}<strong>{money(summary.reviewedGross)}</strong>{summary.reviewed} {t('records')}</p><p>{t('Pending review')}<strong>{money(summary.pendingGross)}</strong>{summary.pending} {t('records')}</p><p>{t('Excluded')}<strong>{money(summary.excludedGross)}</strong>{summary.excluded} {t('records')}</p><p>{t('Completeness checklist')}<strong>{summary.checksCompleted}/7</strong>{t('sections reviewed')}</p></div>

 <section className={s.notice} aria-label={l('Invoice evidence readiness','Control documental de facturas')}>
  <h2>{l('Purchase evidence to resolve','Documentación de compras pendiente')}</h2>
  <p>{l('These are source-document and administrative review reminders, not tax, bank-payment or accounting-posting decisions. A PDF mentioned in ChatGPT is not an archived original.','Estos son avisos sobre justificantes y revisiones administrativas, no decisiones fiscales, de pagos bancarios ni de contabilización. Un PDF mencionado en ChatGPT no es un original archivado.')}</p>
  <div className={s.metrics}>
   <p>{l('Supplier concepts','Borradores de proveedor')}<strong>{evidence.total}</strong></p>
   <p>{l('Original PDFs missing','PDF originales pendientes')}<strong>{evidence.missingOriginals}</strong></p>
   <p>{l('Costs pending review','Costes pendientes de revisión')}<strong>{evidence.pendingCostReview}</strong></p>
   <p>{l('Archived PDFs needing review','PDF archivados por revisar')}<strong>{evidence.pendingArchiveReview}</strong></p>
  </div>
  <p>{l('The accountant year package contains a complete, per-invoice evidence action CSV. Showing up to 25 unresolved invoices below.','El paquete anual para el asesor contiene un CSV completo de incidencias por factura. A continuación se muestran hasta 25 facturas pendientes.')}</p>
  <div className={s.tableWrap}><table className={s.table}>
   <thead><tr><th>{l('Invoice','Factura')}</th><th>{l('Evidence','Justificantes')}</th><th>{l('Action','Acción')}</th></tr></thead>
   <tbody>{evidence.unresolved.slice(0,25).map(row=><tr key={row.draft_id}>
    <td>{row.invoice_number}<small>{row.supplier_name}</small><small>{row.invoice_date} · {money(row.gross_cents)}</small></td>
    <td>{sourceName[row.source]}<small>{row.issues.map(key=>issueName[key]).join(' · ')}</small></td>
    <td><Link href={attachmentHref('cost',row.draft_id)}>{l('Manage original PDFs','Gestionar PDF originales')}</Link>{' · '}<Link href={root+'#costs'}>{l('Review costs','Revisar costes')}</Link></td>
   </tr>)}{evidence.unresolved.length===0&&<tr><td colSpan={3}>{l('No unresolved evidence actions for registered supplier concepts. This does not confirm a complete financial year.','No hay incidencias documentales pendientes en los borradores registrados. Esto no confirma que el ejercicio esté completo.')}</td></tr>}</tbody>
  </table></div>
 </section>

 <section className={s.notice} aria-label={l('Supplier identity quality','Calidad de los datos del proveedor')}>
  <h2>{l('Supplier master data checks','Comprobación de datos de proveedores')}</h2>
  <p>{l('New suppliers are already created by the existing workflow. This review only detects possible duplicates or missing company tax IDs in existing Relationships; it never creates, combines, changes, or blocks a supplier.','Los proveedores nuevos ya se crean mediante el flujo existente. Esta revisión solo señala posibles duplicados o identificadores fiscales de empresas ausentes en las relaciones; nunca crea, fusiona, modifica ni bloquea proveedores.')}</p>
  <div className={s.metrics}>
   <p>{l('Suppliers referenced this year','Proveedores utilizados este ejercicio')}<strong>{supplierIntegrity.supplierCount}</strong></p>
   <p>{l('Possible duplicate supplier records','Posibles proveedores duplicados')}<strong>{supplierIntegrity.possibleDuplicateSuppliers}</strong></p>
   <p>{l('Company tax IDs to verify','Identificadores fiscales por verificar')}<strong>{supplierIntegrity.missingTaxIdSuppliers}</strong></p>
  </div>
  <p>{l('A missing tax ID is a check only where applicable. Exact normalized names are considered possible matches only when their recorded tax IDs do not conflict. All corrections require manual verification.','La ausencia de un número fiscal solo requiere comprobación cuando proceda. Los nombres normalizados coincidentes solo se consideran posibles duplicados si los identificadores fiscales no difieren. Cualquier corrección requiere comprobación manual.')}</p>
  {[...new Map(supplierIntegrity.signals.filter(row=>row.possible_duplicate_records.length||row.missing_company_tax_id||row.missing_record).map(row=>[row.supplier_id,row])).values()].slice(0,25).map(row=>
   <p key={row.draft_id}>
    <strong>{row.supplier_name||l('Unresolved supplier reference','Referencia de proveedor no encontrada')}</strong>
    {' · '}
    {row.missing_record?l('Supplier record unavailable','Registro de proveedor no disponible'):row.missing_company_tax_id?l('Company tax ID not recorded','Falta el identificador fiscal de la empresa'):''}
    {row.possible_duplicate_records.map(candidate=>
     <span key={candidate.id}>{' · '}{l('Potential duplicate','Posible duplicado')}: {candidate.name} ({candidate.reason==='same_tax_id'?l('matching tax ID','mismo identificador fiscal'):l('matching normalized name','mismo nombre normalizado')})</span>
    )}
   </p>
  )}
  <p><Link href="/admin/relationships">{l('Review existing Relationships','Revisar relaciones existentes')}</Link></p>
 </section>
 <p className={s.notice}>{t('Cost totals use original gross amounts. They are collection totals, not final deductible expenses. The year package includes pending items and exceptions for the accountant to resolve.')}</p>
 {y.vat_treatment==='pending'&&<p role="status">{t('VAT treatment still needs an effective date and supporting confirmation. Historical VAT records remain unchanged.')}</p>}
 <nav className={s.links}>{purchaseWorkspaceEnvironment()&&<Link href={PDF_ROOT+'?year='+id}>{language==='es'?'PDF de compras':'Purchase PDFs'}</Link>}<Link href={root+'/import'}>{t('Prepare a cost import')}</Link><Link href={'/admin/workspaces/accountancy/sales?entity='+y.issuer_id+'&year='+y.fiscal_year}>{t('Invoices')}</Link><Link href={'/admin/workspaces/accountancy/documents?entity='+y.issuer_id+'&year='+y.fiscal_year}>{t('Supporting documents')} ({source.documents.length})</Link><Link href="/admin/group/capital">{t('Capital')}</Link><Link href="/admin/workspaces/estates/entities">{t('Legal property associations')}</Link></nav>
 <YearForm key={y.revision} year={y}/><h2>{t('Cost categories')}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{t('Category')}</th><th>{t('Reviewed')}</th><th>{t('Pending review')}</th><th>{t('Excluded')}</th></tr></thead><tbody>{summary.categories.map(c=><tr key={c.key}><td>{t(costCategories[c.key])}</td><td>{money(c.reviewedGross)}</td><td>{money(c.pendingGross)}</td><td>{money(c.excludedGross)}</td></tr>)}</tbody></table></div>
 <h2>{t('Renovation and improvement projects')}</h2>{source.projects.length?<ul className={s.projectList}>{source.projects.map(p=><li key={p.id}><strong>{p.name}</strong><p>{t(costCategories[p.kind])} · {properties.find(x=>x.id===p.property_id)?.name??t('Company-level costs')}</p><small>{p.source_reference}</small></li>)}</ul>:<p>{t('No projects recorded for this year.')}</p>}<ProjectForm yearId={id} properties={properties}/><div id="create-cost"><CostForm year={y} properties={properties} suppliers={suppliers}/></div>
 <h2 id="costs">{t('Supplier costs')}</h2><form className={s.filters} method="get"><label>{t('Review status')}<select name="status" defaultValue={status}><option value="all">{t('All')}</option><option value="pending">{t('Pending review')}</option><option value="reviewed">{t('Reviewed')}</option><option value="excluded">{t('Excluded')}</option></select></label><label>{t('Category')}<select name="category" defaultValue={category}><option value="all">{t('All')}</option>{Object.entries(costCategories).map(([k,label])=><option key={k} value={k}>{t(label)}</option>)}</select></label><button className={s.button}>{t('Filter')}</button></form>
 <p>{costs.length} {t('records')}</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{t('Invoice')}</th><th>{t('Allocation')}</th><th>{t('Gross amount')}</th><th>{t('Review')}</th></tr></thead><tbody>{costs.slice((page-1)*25,page*25).map(c=>{const r=reviews.get(c.id);return <tr key={c.id}><td>{c.supplier_invoice_number}<small>{c.supplier_name}</small><small>{new Intl.DateTimeFormat(locale,{timeZone:'UTC'}).format(new Date(c.invoice_date+'T12:00:00Z'))}</small><p>{c.description}</p>{c.source_pdf_id&&<Link href={PDF_ROOT+'/'+c.source_pdf_id}>{language==='es'?'PDF original':'Original PDF'}</Link>}{c.archive_documents?.map(d=><p key={d.id}><a href={ARCHIVE_ROOT+'/'+d.id+'/file'} target="_blank" rel="noopener noreferrer">{d.title} ↗</a></p>)}<p><Link href={attachmentHref('cost',c.id)}>{language==='es'?'Gestionar PDF adjuntos':'Manage PDF attachments'}</Link></p></td><td>{c.property_name??t('Company-level costs')}<small>{t(costCategories[r?.category??annualCategory(c.category)])}</small><small>{source.projects.find(p=>p.id===r?.project_id)?.name}</small></td><td>{money(c.gross_cents)}<small>{t('Original VAT')}: {money(c.vat_cents)}</small></td><td><p>{t(r?.review_status==='reviewed'?'Reviewed':r?.review_status==='excluded'?'Excluded':'Pending review')}</p><CostReviewForm key={r?.revision??0} cost={c} review={r} projects={source.projects} yearId={id}/></td></tr>;})}{!costs.length&&<tr><td colSpan={4}>{t('No supplier costs match these filters.')}</td></tr>}</tbody></table></div><nav className={s.pagination}>{page>1&&<Link href={href(page-1)}>{t('Previous')}</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={href(page+1)}>{t('Next')}</Link>}</nav>
 <p className={s.notice}>{t('The checklist records a manual review at the time of saving. Review it again after adding or changing source records. Exports never mark invoices as paid or send data to an accountant.')}</p></section>;
}
