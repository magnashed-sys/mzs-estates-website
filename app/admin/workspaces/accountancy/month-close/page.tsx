import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {annualSource} from '../../../../../lib/accountancy/administration-data';
import {bankSource} from '../../../../../lib/accountancy/bank/data';
import {loadInvoiceRegister} from '../../../../../lib/finance/invoice-register';
import {monthCloseReadiness} from '../../../../../lib/accountancy/month-close-readiness';
import {uuid,type Year} from '../../../../../lib/accountancy/administration';
import s from './readiness.module.css';

export const dynamic='force-dynamic';
type Query=Record<string,string|string[]|undefined>;
const param=(q:Query,k:string)=>typeof q[k]==='string'?q[k] as string:'';

export default async function MonthClose({searchParams}:{searchParams:Promise<Query>}){
 const {db}=await requireEstateAdmin();
 const {language,locale}=await getAdminI18n(),l=(en:string,es:string)=>language==='es'?es:en;
 const p=await searchParams,requested=param(p,'administration'),selectedMonth=param(p,'month');
 if(requested&&!uuid.test(requested))notFound();
 if(selectedMonth&&!/^(0[1-9]|1[0-2])$/.test(selectedMonth))notFound();
 const [years,issuers]=await Promise.all([
  allRows<Year>((a,b)=>db.from('mzs_accountancy_years').select('*',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b)),
  allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_issuers').select('id,name',{count:'exact'}).order('name').order('id').range(a,b))
 ]);
 const currentYear=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Madrid',year:'numeric'}).format(new Date());
 const chosen=requested?years.find(y=>y.id===requested):(years.find(y=>y.purpose==='current'&&String(y.fiscal_year)===currentYear)??years.find(y=>y.purpose==='current')??years[0]);
 if(requested&&!chosen)notFound();
 const currentMonth=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Madrid',month:'2-digit'}).format(new Date()));
 const month=selectedMonth||String(chosen?.fiscal_year===Number(currentYear)?currentMonth:12).padStart(2,'0');
 const yearMonth=chosen?.fiscal_year+'-'+month;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const entityName=issuers.find(x=>x.id===chosen?.issuer_id)?.name??l('Unknown entity','Entidad desconocida');
 let error=false;let bankWarning=false;
 let report:ReturnType<typeof monthCloseReadiness>|null=null;
 if(chosen)try{
  // Never present partial financial figures if either primary source fails.
  const [annual,invoices]=await Promise.all([annualSource(db,chosen.id),loadInvoiceRegister(db,chosen.fiscal_year)]);
  const bank=await bankSource(db,chosen.id).catch(()=>{bankWarning=true;return null;});
  report=monthCloseReadiness(annual,invoices,yearMonth,today,bank);
 }catch{error=true;}
 const euro=(n:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100);
 const monthNames=Array.from({length:12},(_,i)=>({value:String(i+1).padStart(2,'0'),label:new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(chosen?.fiscal_year??2026,i,15)))}));
 const start=yearMonth+'-01',end=new Date(Date.UTC(chosen?.fiscal_year??2026,Number(month),0)).toISOString().slice(0,10);
 const purchase=new URLSearchParams({entity:chosen?.issuer_id??'',from:start,until:end});
 const invoice=new URLSearchParams({year:String(chosen?.fiscal_year??''),entity:chosen?.issuer_id??''});
 const checks=[
  {label:l('Missing original purchase PDFs','PDF originales de compra pendientes'),count:report?.purchases.missingOriginals??null,href:'/admin/workspaces/accountancy/purchase-inbox?administration='+chosen?.id+'&group=originals'},
  {label:l('Purchase concepts awaiting review','Borradores de compra por revisar'),count:report?.purchases.pendingReview??null,href:'/admin/workspaces/accountancy/administrations/'+chosen?.id+'#costs'},
  {label:l('Private PDFs awaiting document review','PDF privados pendientes de revisión'),count:report?.purchases.archiveReview??null,href:'/admin/workspaces/accountancy/completeness?administration='+chosen?.id+'&group=documents'},
  {label:l('Possible duplicate purchase invoices','Posibles facturas de compra duplicadas'),count:report?.purchases.duplicateSignals??null,href:'/admin/workspaces/accountancy/purchase-inbox?administration='+chosen?.id+'&group=duplicates'},
  {label:l('Sales invoices with unknown payment balance','Facturas de venta con saldo desconocido'),count:report?.invoices.unknownBalances??null,href:'/admin/workspaces/accountancy/sales?'+new URLSearchParams({...Object.fromEntries(invoice),status:'unknown'})},
  {label:l('Sales invoices issued this month awaiting recorded settlement','Facturas del mes pendientes de cobro registrado'),count:report?.invoices.unpaidCount??null,href:'/admin/workspaces/accountancy/sales?'+new URLSearchParams({...Object.fromEntries(invoice),status:'open'})},
  {label:l('Imported bank transactions dated this month awaiting allocation','Movimientos bancarios importados con fecha del mes pendientes de asignación'),count:report?.bank.unallocatedTransactions??null,href:'/admin/workspaces/accountancy/administrations/'+chosen?.id+'/bank'}
 ];
 return <main className={s.page}>
  <Link href="/admin/workspaces/accountancy" className={s.back}>{l('← Accountancy','← Contabilidad')}</Link>
  <header className={s.heading}>
   <p className={s.eyebrow}>{l('MZS GROUP / FINANCIAL CONTROLS','MZS GROUP / CONTROLES FINANCIEROS')}</p>
   <h1>{l('Monthly financial review','Revisión financiera mensual')}</h1>
   <p>{l('A source-backed preparation checklist for your accountant. Review invoices, original PDFs, payment balances and imported bank transactions without posting anything.','Lista de comprobación basada en registros para preparar la revisión con el asesor. Revise facturas, PDF originales, saldos y movimientos bancarios sin contabilizar nada.')}</p>
  </header>
  <form method="get" className={s.filters}>
   <label>{l('Legal entity and financial year','Entidad legal y ejercicio')}<select name="administration" defaultValue={chosen?.id??''} required>
    <option value="" disabled>{l('Choose administration','Seleccione administración')}</option>
    {years.map(y=><option key={y.id} value={y.id}>{issuers.find(i=>i.id===y.issuer_id)?.name??y.issuer_id} · {y.fiscal_year}{y.purpose==='reference'?' · '+l('Reference','Referencia'):''}</option>)}
   </select></label>
   <label>{l('Month','Mes')}<select name="month" defaultValue={month}>
    {monthNames.map(m=><option key={m.value} value={m.value}>{m.label} · {chosen?.fiscal_year??currentYear}</option>)}
   </select></label>
   <button type="submit">{l('Review month','Revisar mes')}</button>
  </form>
  {!chosen&&<p role="status">{l('There are no registered annual administrations to review.','No hay administraciones anuales registradas.')}</p>}
  {error&&<p className={s.error} role="alert">{l('The full financial sources could not be verified; partial totals are hidden.','No se han podido verificar todos los registros financieros; se ocultan los totales parciales.')}</p>}
  {report&&chosen&&<>
   <p className={s.context}>{entityName} · {chosen.fiscal_year} · {monthNames.find(x=>x.value===month)?.label} <span>{l('Invoice balances reflect the latest recorded status, not the historic month end.','Los saldos reflejan el estado registrado actual, no el cierre histórico del mes.')}</span></p>
   <section className={s.metrics} aria-label={l('Monthly source overview','Resumen mensual de registros')}>
    <div><small>{l('Issued sales invoices','Facturas emitidas')}</small><strong>{report.invoices.count}</strong><span>{l('Including credit notes · issue dates in month · imported archive rows excluded','Incluidos abonos · por fecha de emisión · registros del archivo importado excluidos')}</span></div>
    <div><small>{l('Recorded outstanding on those invoices','Saldo pendiente registrado de esas facturas')}</small><strong>{euro(report.invoices.outstandingCents)}</strong><span>{l('Current recorded balance, not month-end cash','Saldo registrado actual, no efectivo al cierre')}</span></div>
    <div><small>{l('Recorded overdue on those invoices','Saldo vencido registrado de esas facturas')}</small><strong>{euro(report.invoices.overdueCents)}</strong><span>{l('Past due as of today','Vencido a fecha de hoy')}</span></div>
    <div><small>{l('Purchase concepts with invoice dates in month','Borradores de compra con fecha de factura del mes')}</small><strong>{report.purchases.count}</strong><span>{euro(report.purchases.grossConceptCents)} {l('gross concepts, not posted costs','en borradores brutos, no gastos contabilizados')}</span></div>
    <div><small>{l('Recorded invoice receipts','Cobros de facturas registrados')}</small><strong>{euro(report.invoices.receivedRecordedCents)}</strong><span>{l('Cumulative receipts on invoices issued in month; receipt dates may differ','Cobros acumulados en facturas del mes; las fechas de cobro pueden diferir')}</span></div>
    <div><small>{l('Imported bank transactions awaiting allocation','Movimientos bancarios importados sin asignar')}</small>
     <strong>{report.bank.status==='available'?euro(report.bank.unallocatedAbsoluteCents!):l('Not available','No disponible')}</strong>
     <span>{l('By bank booking date · absolute unmatched portions only; no proof of bank reconciliation','Por fecha contable bancaria · partes sin asignar en valor absoluto; no acredita conciliación')}</span></div>
   </section>
   <p className={s.notice}>{l('Amounts in this view must NOT be combined to infer profit, cash flow or a certified closing balance. Invoice balances are current snapshots, original document checks relate to purchase concepts, and bank transactions only cover imported statements. No period is locked or automatically closed.','Los importes NO deben sumarse para calcular beneficios, caja o saldos de cierre certificados. Los saldos son actuales, los controles documentales se refieren a borradores y los movimientos bancarios solo cubren extractos importados. No se bloquea ni cierra ningún período.')}</p>
   <section className={s.panel}>
    <div className={s.panelHeading}><h2>{l('Action list for this month','Acciones pendientes del mes')}</h2><span>{l('Monthly counts · annual source registers','Recuentos mensuales · registros anuales')}</span></div>
    <p>{l('The counts below cover the selected month. The links open source registers for the selected entity and year, so they can show additional months, imported invoices or different review groupings. Their counts may therefore differ.','Los recuentos siguientes corresponden al mes seleccionado. Los enlaces abren los registros de la entidad y el ejercicio seleccionados, que pueden incluir otros meses, facturas importadas o distintas agrupaciones de revisión. Por ello, sus recuentos pueden diferir.')}</p>
    <div className={s.list}>
     {checks.map(check=><article className={s.item} key={check.label}>
      <div><strong>{check.count===null?l('Unknown','Desconocido'):check.count}</strong><div><h3>{check.label}</h3><p>{check.count===null?l('Bank import data was unavailable, so no zero was assumed.','No hay datos bancarios disponibles; no se ha supuesto un cero.'):check.count===0?l('No flagged entries in the available registers; further checks may still be needed.','Sin incidencias en los registros disponibles; pueden faltar otras comprobaciones.'):l('Review the underlying source before resolving.','Revise los datos originales antes de resolver.')}</p></div></div>
      <Link href={check.href}>{l('Open annual register →','Abrir registro anual →')}</Link>
     </article>)}
    </div>
    {bankWarning&&<p role="status" className={s.warning}>{l('Bank register could not be loaded. Bank readiness is unknown; do not treat it as reconciled.','No se pudo cargar el registro bancario. La conciliación es desconocida; no se considera realizada.')}</p>}
   </section>
   <section className={s.panel}>
    <h2>{l('Annual controls and accountant handover','Controles anuales y entrega al asesor')}</h2>
    <p>{l('Annual checklist status is separate from this monthly preparation worklist. A completed checklist is not a certified account close.','La lista anual es independiente de esta preparación mensual. Su cumplimiento no certifica el cierre contable.')}</p>
    <p><strong>{report.checklist.completed}/{report.checklist.total}</strong> {l('annual checklist sections marked reviewed','apartados anuales marcados como revisados')}</p>
    <nav className={s.links}>
     <Link href={'/admin/workspaces/accountancy/administrations/'+chosen.id}>{l('Annual administration','Administración anual')} →</Link>
     <Link href={'/admin/workspaces/estates/expenses?'+purchase.toString()+'#expense-register'}>{l('Purchase concepts for this month','Borradores de compra de este mes')} →</Link>
     <Link href={'/admin/workspaces/accountancy/sales?'+invoice.toString()}>{l('Sales invoices for selected year/entity','Facturas emitidas del año y entidad')} →</Link>
     <Link href={'/admin/workspaces/accountancy/performance?administration='+chosen.id}>{l('Property & project report','Informe por inmueble y proyecto')} →</Link>
    </nav>
   </section>
  </>}
 </main>;
}
