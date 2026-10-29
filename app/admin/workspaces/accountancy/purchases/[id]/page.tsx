import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePdfAdmin} from '../../../../../../lib/accountancy/pdf/server';
import {PDF_ROOT,type ExtractedPage} from '../../../../../../lib/accountancy/pdf/model';
import {uuid,ADMINISTRATION_ROOT} from '../../../../../../lib/accountancy/administration';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import {ReviewPdf} from '../Forms';
import s from '../../administrations/administration.module.css';
export const dynamic='force-dynamic';
export default async function Purchase({params}:{params:Promise<{id:string}>}){
 const {db}=await requirePdfAdmin(),{language}=await getAdminI18n(),l=(en:string,es:string)=>language==='es'?es:en,{id}=await params;if(!uuid.test(id))notFound();
 const intake=await db.from('mzs_purchase_pdf_intakes').select('*').eq('id',id).maybeSingle();if(intake.error)throw Error('PDF register unavailable');if(!intake.data)notFound();const i=intake.data;
 const [result,decision,year,issuer]=await Promise.all([db.from('mzs_purchase_pdf_results').select('*').eq('intake_id',id).maybeSingle(),db.from('mzs_purchase_pdf_decisions').select('*').eq('intake_id',id).maybeSingle(),db.from('mzs_accountancy_years').select('fiscal_year').eq('id',i.year_id).single(),db.from('mzs_lease_issuers').select('name').eq('id',i.issuer_id).single()]);
 if(result.error||decision.error||year.error||issuer.error)throw Error('PDF review unavailable');const r=result.data,d=decision.data,clean=r?.verdict==='clean';
 const choices=async(table:string)=>allRows<{id:string;name:string}>((a,b)=>db.from(table).select('id,name',{count:'exact'}).order('name').order('id').range(a,b));
 const [suppliers,properties,projects]=r&&!d&&clean?await Promise.all([choices('mzs_lease_relationships'),choices('mzs_estate_properties'),allRows<{id:string;name:string;property_id:string|null}>((a,b)=>db.from('mzs_accountancy_projects').select('id,name,property_id',{count:'exact'}).eq('year_id',i.year_id).order('name').order('id').range(a,b))]):[[],[],[]];
 return <section className={s.page}><Link href={PDF_ROOT+'?year='+i.year_id}>← {l('Purchase PDFs','PDF de compras')}</Link><h1>{i.original_name}</h1><p>{issuer.data.name} · {year.data.fiscal_year}</p><p style={{overflowWrap:'anywhere'}}>SHA-256: <code>{i.sha256}</code></p>
 {clean&&<a className={s.button} href={PDF_ROOT+'/'+id+'/original'}>{l('Download original PDF for review','Descargar PDF original para revisión')}</a>}
 {!r&&<p role="status">{l('The original is quarantined and cannot be opened or confirmed yet. Return to the register and upload the same PDF to retry processing.','El original está en cuarentena y todavía no puede abrirse ni confirmarse. Vuelva al registro y cargue el mismo PDF para reintentar el procesamiento.')}</p>}
 {r&&!clean&&<p role="alert">{l('Security scan blocked this document. Opening and purchase creation are disabled.','El análisis de seguridad bloqueó este documento. No se permite abrirlo ni crear una compra.')}</p>}
 {clean&&<><p className={s.notice}>{r.extraction==='manual'?l('No reliable text could be read. Enter details manually after checking the original.','No se pudo leer texto fiable. Introduzca los datos manualmente tras revisar el original.'):l('Text recognition provides suggestions only. Always check the original invoice.','El reconocimiento de texto solo proporciona sugerencias. Compruebe siempre la factura original.')}</p><details><summary>{l('Recognised text — unverified','Texto reconocido: sin verificar')}</summary>{(r.pages as ExtractedPage[]).map(p=><div key={p.page}><h3>{l('Page','Página')} {p.page}</h3><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{p.text}</pre></div>)}</details></>}
 {d?<><h2>{d.action==='accepted'?l('Purchase concept created','Borrador de compra creado'):l('Document rejected','Documento rechazado')}</h2><p>{d.reason}</p><p>{l('Decision recorded by','Decisión registrada por')} {d.actor_id} · {d.created_at}</p>{d.action==='accepted'&&<Link href={ADMINISTRATION_ROOT+'/'+i.year_id+'#costs'}>{l('Review the purchase in the annual administration','Revisar la compra en la administración anual')}</Link>}</>:r&&<ReviewPdf intake={id} result={r.id} proposal={r.proposal} suppliers={suppliers} properties={properties} projects={projects} clean={clean}/>}
 </section>;
}
