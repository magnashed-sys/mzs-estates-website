import Link from 'next/link';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {archiveEntities} from '../../../../../lib/accountancy/archive-data';
import {annualSource} from '../../../../../lib/accountancy/administration-data';
import {type Year} from '../../../../../lib/accountancy/administration';
import {type SupplierIdentity} from '../../../../../lib/accountancy/supplier-integrity';
import {completenessItems,completenessLabels} from '../../../../../lib/accountancy/completeness';
import s from '../administrations/administration.module.css';
export const dynamic='force-dynamic';
export default async function Completeness({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db}=await requireEstateAdmin(),{language}=await getAdminI18n(),q=await searchParams,l=(en:string,es:string)=>language==='es'?es:en;
 const [entities,years]=await Promise.all([archiveEntities(db),allRows<Year>((a,b)=>db.from('mzs_accountancy_years').select('*',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b))]);
 const selected=years.find(y=>y.id===q.administration);
 let failed=false,items:ReturnType<typeof completenessItems>=[];
 if(selected)try{
  const [source,suppliers]=await Promise.all([annualSource(db,selected.id),allRows<SupplierIdentity>((a,b)=>db.from('mzs_lease_relationships').select('id,name,kind,company_details',{count:'exact'}).order('id').range(a,b))]);items=completenessItems(source,suppliers);
 }catch{failed=true;}
 const group=typeof q.group==='string'&&['documents','review','suppliers'].includes(q.group)?q.group:'';
 const filtered=items.filter(i=>!group||i.group===group),pages=Math.max(1,Math.ceil(filtered.length/30)),page=Math.min(pages,typeof q.page==='string'&&/^[1-9]\d{0,5}$/.test(q.page)?Number(q.page):1);
 const href=(p:number)=>'?'+new URLSearchParams({administration:selected!.id,group,page:String(p)});
 return <section className={s.page}><Link href="/admin/workspaces/accountancy">← Accountancy</Link><header className={s.heading}><div><h1>{l('Completeness center','Centro de integridad documental')}</h1><p>{l('One worklist for source documents, review reminders and supplier links in a selected entity/year.','Una lista para documentos, revisiones y vínculos de proveedores de una entidad y ejercicio.')}</p></div></header>
 <form method="GET" className={s.filters}><label>{l('Administration','Administración')}<select name="administration" defaultValue={selected?.id??''} required><option value="" disabled>{l('Select entity and year','Seleccione entidad y ejercicio')}</option>{years.map(y=><option key={y.id} value={y.id}>{entities.find(e=>e.id===y.issuer_id)?.name??y.issuer_id} · {y.fiscal_year}</option>)}</select></label><label>{l('Show','Mostrar')}<select name="group" defaultValue={group}><option value="">{l('All checks','Todos los controles')}</option><option value="documents">{l('Documents','Documentos')}</option><option value="review">{l('Review','Revisión')}</option><option value="suppliers">{l('Suppliers','Proveedores')}</option></select></label><button className={s.button} type="submit">{l('Check administration','Comprobar administración')}</button></form>
 {!selected&&<p role="status">{l('Select an administration to load its checks. No checks have been performed yet.','Seleccione una administración. Todavía no se han realizado controles.')}</p>}
 {failed?<p role="alert">{l('Checks could not be loaded completely. Please retry; no completeness result is available.','No se pudieron cargar todos los controles. Inténtelo de nuevo; no hay resultado disponible.')}</p>:selected&&<>
 <div className={s.metrics}><p>{l('Items needing attention','Elementos por revisar')}<strong>{items.length}</strong></p>{(['documents','review','suppliers'] as const).map(g=><p key={g}>{g==='documents'?l('Documents','Documentos'):g==='review'?l('Review','Revisión'):l('Suppliers','Proveedores')}<strong>{items.filter(i=>i.group===g).length}</strong></p>)}</div>
 <p>{filtered.length} {l('results in this filter','resultados en este filtro')} · {l('Page','Página')} {page}/{pages}</p>
 <div className={s.tableWrap}><table className={s.table}><thead><tr><th>{l('Record','Registro')}</th><th>{l('Check','Control')}</th><th>{l('Action','Acción')}</th></tr></thead><tbody>{filtered.slice((page-1)*30,page*30).map(i=><tr key={i.id}><td>{i.label}</td><td>{i.issues.map(code=><div key={code}>{completenessLabels[code]?.[language==='es'?1:0]??code}</div>)}</td><td><Link href={i.href}>{l('Open source →','Abrir origen →')}</Link></td></tr>)}</tbody></table></div>
 {!filtered.length&&<p>{l('No outstanding items found within these checks and this filter. This is not a certification of complete accounts.','No hay incidencias en estos controles y filtro. No es una certificación de cuentas completas.')}</p>}
 <nav className={s.pagination} aria-label={l('Results pages','Páginas de resultados')}>{page>1&&<Link href={href(page-1)}>← {l('Previous','Anterior')}</Link>} {' '}{page<pages&&<Link href={href(page+1)}>{l('Next','Siguiente')} →</Link>}</nav></>}
 <p className={s.notice}>{l('Read-only checks of registered records. Missing invoices not yet entered cannot be detected. Company overhead does not require a property. Duplicate signals require manual review. Bank reconciliation remains deferred; no payment, VAT, approval or completeness status is changed. Refresh after correcting a source.','Controles de solo lectura de registros existentes. No se detectan facturas aún no registradas. Los gastos generales no requieren inmueble. Los posibles duplicados requieren revisión manual. La conciliación bancaria queda aplazada; no se modifican pagos, IVA, aprobaciones ni estados de integridad. Actualice tras corregir el origen.')}</p></section>;
}
