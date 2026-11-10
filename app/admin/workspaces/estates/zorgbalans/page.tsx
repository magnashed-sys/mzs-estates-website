import Link from 'next/link';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {operationsDay} from '../../../../../lib/property-operations/action-queues';
import {DraftForm,ConfirmSent,type Visit,type Invoice} from './BillingControls';
import s from './zorgbalans.module.css';
export const dynamic='force-dynamic';
export default async function ZorgbalansBilling(){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const {language}=await getAdminI18n();
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const [visits,invoices,people,settings]=await Promise.all([
  allRows<Visit>((a,b)=>db.from('mzs_ops_zorgbalans_billable_visits').select('id,worked_on,profile_id,effective_minutes,description,invoiced_hours,net_cents',{count:'exact'}).order('worked_on').order('id').range(a,b)),
  allRows<Invoice>((a,b)=>db.from('mzs_ops_zorgbalans_invoices').select('id,invoice_number,issued_on,due_on,period_from,period_until,hours,net_cents,vat_cents,gross_cents,status,confirmation_note',{count:'exact'}).order('issued_on',{ascending:false}).order('id').range(a,b)),
  allRows<{id:string;full_name:string|null}>((a,b)=>db.from('profiles').select('id,full_name',{count:'exact'}).order('id').range(a,b)),
  db.from('mzs_ops_lease_cleaning_settings').select('contract_id,description,starts_on').eq('work_area_id','zorgbalans').maybeSingle()
 ]);
 if(settings.error)throw new Error('Cleaning billing configuration could not be loaded.');
 const monthly=settings.data;
 const euro=(c:number)=>(c/100).toLocaleString(language==='es'?'es-ES':'en-GB',{style:'currency',currency:'EUR'});
 const hours=visits.reduce((n,v)=>n+v.invoiced_hours,0),net=visits.reduce((n,v)=>n+v.net_cents,0);
 return <main className={s.page}>
  <Link href="/admin/workspaces/estates/operations">{tr('← Operations Cockpit','← Panel de operaciones')}</Link>
  <p className={s.kicker}>{tr('PRIVATE BILLING · ZORGBALANS','FACTURACIÓN PRIVADA · ZORGBALANS')}</p>
  <h1>{tr('Zorgbalans · Hours & recharges','Zorgbalans · Horas y refacturación')}</h1>
  <p className={s.intro}>{tr('Time is recorded in the Property Manager Dashboard. Only reviewed and approved visits are available for invoicing here.','El tiempo se registra en el panel de Property Manager. Solo las visitas revisadas y aprobadas están disponibles para facturar aquí.')}</p>
  <div className={s.stats}><div><small>{tr('Available for invoicing','Disponible para facturar')}</small><strong>{visits.length} {tr('visits','visitas')}</strong></div>
   <div><small>{tr('Available invoice hours','Horas facturables disponibles')}</small><strong>{hours} h</strong></div>
   <div><small>{tr('Available excl. VAT','Disponible sin IVA')}</small><strong>{euro(net)}</strong></div>
   <div><small>{tr('Available incl. 21% VAT','Disponible con IVA del 21 %')}</small><strong>{euro(net+Math.round(net*.21))}</strong></div></div>
  <p className={s.muted}>{tr('Historical invoice 7113 (26 hours, €650 excl. VAT, 28 October 2026) remains in the existing archive. Visits before 26 October 2026 are excluded from new invoices here.','La factura histórica 7113 (26 horas, 650 € sin IVA, 28 de octubre de 2026) permanece en el archivo. Las visitas anteriores al 26 de octubre de 2026 se excluyen de las nuevas facturas.')}</p>
  <p><Link href='/admin/workspaces/estates/weekly'>{tr('Review and approve weekly hours →','Revisar y aprobar las horas semanales →')}</Link></p>
  {monthly?<section className={s.card}><h2>{tr('Monthly rental invoice · Schoonmaak','Factura mensual de alquiler · Schoonmaak')}</h2><p style={{whiteSpace:'pre-line'}}>{monthly.description}</p><p>{tr('Approved, uninvoiced visits are included as one cleaning line when the monthly rental draft is prepared. The PDF includes the hours statement as attachment 1. Later approvals remain available for the next invoice, or refresh the pending draft before checking it.','Las visitas aprobadas y sin facturar se añaden en una sola línea de limpieza al preparar el borrador mensual de alquiler. El PDF incluye el detalle de horas como anexo 1. Las aprobaciones posteriores quedan para la siguiente factura; también puede actualizar el borrador pendiente antes de revisarlo.')}</p><p>{tr('€25 per hour · 21% VAT · each visit rounded up to whole hours, minimum one hour.','25 € por hora · IVA del 21 % · cada visita se redondea al alza, mínimo una hora.')}</p><p><Link href={'/admin/group/estates/contracts?view=invoices&contract='+monthly.contract_id}>{tr('Review rental invoices and hours attachments →','Revisar facturas de alquiler y anexos de horas →')}</Link></p>{visits.length>0&&<div className={s.tableWrap}><table><thead><tr><th>{tr('Date / work','Fecha / trabajo')}</th><th>{tr('Approved minutes','Minutos aprobados')}</th><th>{tr('Invoice hours','Horas facturadas')}</th></tr></thead><tbody>{visits.map(v=><tr key={v.id}><td>{v.worked_on} · {v.description}</td><td>{v.effective_minutes}</td><td>{v.invoiced_hours}</td></tr>)}</tbody></table></div>}</section>:<DraftForm visits={visits} people={people} today={operationsDay()} language={language}/>}
  <section className={s.card}><h2>{tr('Previous separate cleaning invoices','Facturas de limpieza separadas anteriores')}</h2>
   {invoices.length?<div className={s.invoiceList}>{invoices.map(i=><article key={i.id} className={s.invoice}>
    <div><strong>{tr('Invoice','Factura')} {i.invoice_number}</strong><p>{i.period_from} – {i.period_until} · {i.hours} h · {euro(i.net_cents)} {tr('excl. VAT','sin IVA')} · {euro(i.gross_cents)} {tr('incl. VAT','con IVA')}</p>
     <p>{tr('Issue date','Fecha de emisión')} {i.issued_on} · {tr('Due date','Vencimiento')} {i.due_on} · {i.status==='concept'?tr('Draft / not sent','Borrador / sin enviar'):tr('Sent externally','Enviada externamente')}</p></div>
    <a href={'/api/admin/zorgbalans/invoices/'+encodeURIComponent(i.id)+'/pdf'}>{i.status==='concept'?tr('Download draft PDF','Descargar PDF del borrador'):tr('Download invoice PDF','Descargar PDF de la factura')}</a>
    {i.status==='concept'?<ConfirmSent invoice={i} language={language}/>:<p className={s.muted}>{tr('Delivery recorded:','Envío registrado:')} {i.confirmation_note}</p>}
   </article>)}</div>:<p>{tr('No new Zorgbalans invoices have been prepared yet.','Aún no se han preparado nuevas facturas de Zorgbalans.')}</p>}
  </section>
  <p className={s.muted}>{tr('Review and issue the combined rental invoice in Rental contracts. Sending remains a separate action.','Revise y emita la factura combinada en Contratos de alquiler. El envío sigue siendo una acción separada.')}</p>
 </main>;
}
