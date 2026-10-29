import Link from 'next/link';
import {requirePdfAdmin,pdfProcessingReady} from '../../../../../lib/accountancy/pdf/server';
import {PDF_ROOT} from '../../../../../lib/accountancy/pdf/model';
import {uuid} from '../../../../../lib/accountancy/administration';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {UploadPdf} from './Forms';
import s from '../administrations/administration.module.css';
export const dynamic='force-dynamic';
export default async function Purchases({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db}=await requirePdfAdmin(),{language}=await getAdminI18n(),l=(en:string,es:string)=>language==='es'?es:en,q=await searchParams;
 const years=await allRows<{id:string;issuer_id:string;fiscal_year:number}>((a,b)=>db.from('mzs_accountancy_years').select('id,issuer_id,fiscal_year',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b));
 const issuers=await allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_issuers').select('id,name',{count:'exact'}).order('name').order('id').range(a,b));
 const year=typeof q.year==='string'&&uuid.test(q.year)?years.find(y=>y.id===q.year):undefined;
 const page=typeof q.page==='string'&&/^[1-9]\d{0,4}$/.test(q.page)?Number(q.page):1;
 const rows=year?await db.from('mzs_purchase_pdf_intakes').select('id,original_name,created_at,mzs_purchase_pdf_results(verdict),mzs_purchase_pdf_decisions(action)',{count:'exact'}).eq('year_id',year.id).order('created_at',{ascending:false}).order('id').range((page-1)*25,page*25-1):null;
 if(rows?.error)throw Error('PDF register unavailable');
 const ready=pdfProcessingReady();
 return <section className={s.page}><Link href="/admin/workspaces/accountancy">← {l('Accountancy','Contabilidad')}</Link><h1>{l('Purchase PDFs','PDF de compras')}</h1>
 <p className={s.notice}>{l('Test environment. Upload originals, check suggestions and confirm purchase concepts. Nothing is marked as paid.','Entorno de pruebas. Cargue originales, revise sugerencias y confirme borradores de compra. Nada se marca como pagado.')}</p>
 {!ready&&<p role="status" className={s.notice}>{l('PDF processing is not yet enabled: the approved security scanner and private processing connection must be configured first. Uploads are disabled.','El procesamiento de PDF aún no está habilitado: primero deben configurarse el escáner de seguridad aprobado y la conexión privada de procesamiento. Las cargas están deshabilitadas.')}</p>}
 <form method="get" className={s.filters}><label>{l('Entity and financial year','Entidad y ejercicio')}<select name="year" required defaultValue={year?.id??''}><option value="" disabled>{l('Select an administration','Seleccione una administración')}</option>{years.map(y=><option key={y.id} value={y.id}>{issuers.find(i=>i.id===y.issuer_id)?.name??y.issuer_id} · {y.fiscal_year}</option>)}</select></label><button className={s.button}>{l('Open','Abrir')}</button></form>
 {year&&<><UploadPdf year={year.id} ready={ready}/><h2>{l('Document register','Registro de documentos')}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{l('Original','Original')}</th><th>{l('Status','Estado')}</th></tr></thead><tbody>{rows?.data?.map(row=>{const decision=Array.isArray(row.mzs_purchase_pdf_decisions)?row.mzs_purchase_pdf_decisions[0]:row.mzs_purchase_pdf_decisions,scan=Array.isArray(row.mzs_purchase_pdf_results)?row.mzs_purchase_pdf_results[0]:row.mzs_purchase_pdf_results;return <tr key={row.id}><td><Link href={PDF_ROOT+'/'+row.id}>{row.original_name}</Link></td><td>{decision?.action==='accepted'?l('Purchase concept created','Borrador de compra creado'):decision?.action==='rejected'?l('Rejected','Rechazado'):!scan?l('Quarantined — retry the same PDF','En cuarentena: vuelva a cargar el mismo PDF'):scan.verdict==='clean'?l('Awaiting your review','Pendiente de su revisión'):l('Blocked by security scan','Bloqueado por análisis de seguridad')}</td></tr>;})}{!rows?.data?.length&&<tr><td colSpan={2}>{l('No PDFs in this administration yet.','Todavía no hay PDF en esta administración.')}</td></tr>}</tbody></table></div>
 <nav className={s.pagination}>{page>1&&<Link href={PDF_ROOT+'?year='+year.id+'&page='+(page-1)}>{l('Previous','Anterior')}</Link>}<span>{page}</span>{page*25<(rows?.count??0)&&<Link href={PDF_ROOT+'?year='+year.id+'&page='+(page+1)}>{l('Next','Siguiente')}</Link>}</nav></>}
 </section>;
}
