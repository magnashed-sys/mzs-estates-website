import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../../../lib/admin/i18n-server';
import {annualSource} from '../../../../../../../lib/accountancy/administration-data';
import {uuid,ADMINISTRATION_ROOT} from '../../../../../../../lib/accountancy/administration';
import {supplierPaymentMode,supplierPaymentRows,paymentOverview} from '../../../../../../../lib/accountancy/supplier-payments';
import {PaymentForms} from './PaymentForms';
import s from '../../administration.module.css';
export const dynamic='force-dynamic';
export default async function SupplierPayments({params}:{params:Promise<{id:string}>}){
 const mode=supplierPaymentMode();if(!mode)notFound();
 const {db}=await requireEstateAdmin(),{id}=await params,{language,locale}=await getAdminI18n();
 if(!uuid.test(id))notFound();
 const source=await annualSource(db,id),rows=await supplierPaymentRows(db,source.costs);
 const overview=paymentOverview(source.costs,source.reviews,rows);
 const l=(en:string,es:string)=>language==='es'?es:en;
 const euro=(cents:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(cents/100);
 const gross=overview.reduce((s,c)=>s+c.gross_cents,0);
 const recorded=overview.reduce((s,c)=>s+c.recorded_cents,0);
 const remaining=gross-recorded;
 return <section className={s.page}>
  <Link href={ADMINISTRATION_ROOT+'/'+id}>← {l('Year administration','Administración anual')}</Link>
  <p><a href={ADMINISTRATION_ROOT+'/'+id+'/export'}>{l('Download accountant ZIP including supplier payment audit','Descargar ZIP para el asesor con auditoría de pagos a proveedores')}</a></p>
  <header className={s.heading}><div><h1>{mode==='synthetic'?l('Supplier payment register — SYNTHETIC STAGING TEST','Registro de pagos a proveedores — PRUEBA FICTICIA EN STAGING'):l('Supplier payment register — existing transfers','Registro de pagos a proveedores — movimientos ya realizados')}</h1>
   <p>{source.sales.issuer.name} · {source.administration.fiscal_year}</p></div></header>
  <p className={s.notice}>{mode==='synthetic'?l('STAGING TEST ONLY. All entries here must be fictitious. No real bank transfers or cash payments should be recorded. A test record never proves that a supplier invoice is paid or unpaid. Production remains disabled.','SOLO PRUEBAS EN STAGING. Todas las anotaciones deben ser ficticias. No registre transferencias bancarias ni pagos reales. Una prueba no demuestra si una factura está pagada o impagada. Production sigue desactivado.'):l('Existing payments can only be entered after checking their source reference and actual transfer. This is a manually maintained register, NOT bank reconciliation or proof of final tax treatment. No bank transfer is initiated here.','Solo se pueden anotar pagos ya realizados tras verificar su justificante, referencia y transferencia real. Este registro manual NO constituye una conciliación bancaria ni un tratamiento fiscal definitivo. Aquí no se inicia ninguna transferencia.')}</p>
  <div className={s.metrics}>
   <p>{l('Supplier invoice concept totals','Total de borradores de proveedores')}<strong>{euro(gross)}</strong></p>
   <p>{mode==='synthetic'?l('Synthetic payment entries','Anotaciones ficticias de pago'):l('Existing payment entries recorded','Pagos reales anotados administrativamente')}<strong>{euro(recorded)}</strong></p>
   <p>{mode==='synthetic'?l('Not covered by synthetic entries','Sin cobertura por anotaciones ficticias'):l('Not matched to an administrative payment entry','Sin anotación administrativa de pago')}<strong>{euro(remaining)}</strong></p>
   <p>{l('Bank reconciliation','Conciliación bancaria')}<strong>{l('Not verified','No verificado')}</strong></p>
  </div>
  <p>{mode==='synthetic'?l('A Staging administrator can simulate partial payments against the synthetic, reviewed supplier cost using fictitious dates and references. The system rejects totals above the invoice and retains corrections. No bank transaction is executed.','Un administrador de Staging puede simular pagos parciales sobre el coste ficticio revisado usando fechas y referencias de prueba. El sistema rechaza importes superiores a la factura y conserva las correcciones. No se ejecutan movimientos bancarios.'):l('Only manually record verified prior transfers for reviewed supplier costs. Amounts may be split into partial entries; corrections preserve the original record and never cause a bank refund. Advances or overpayments require separate handling.','Registre únicamente transferencias ya realizadas y verificadas para costes revisados. Se permiten pagos parciales; las correcciones conservan el registro original y no ejecutan devoluciones bancarias. Los anticipos y sobrepagos requieren un proceso separado.')}</p>
  {mode==='synthetic'&&<details className={s.panel}><summary>{l('Staging acceptance checklist','Lista de comprobación de Staging')}</summary>
   <p>{l('Use only synthetic test payment references and the existing synthetic invoice. This pilot is not Production and must never be used for a real transfer.','Utilice exclusivamente referencias de pago de prueba y la factura ficticia existente. Este piloto no es Production y nunca debe utilizarse para una transferencia real.')}</p>
   <ol>
    <li>{l('Open the annual cost review and mark only the synthetic invoice Reviewed with a synthetic evidence reference.','Abra la revisión de costes del ejercicio y marque solo la factura ficticia como revisada con una referencia de prueba.')}</li>
    <li>{l('Record a first partial payment, confirm the current remaining amount, then record a second partial payment.','Registre un primer pago parcial, compruebe el importe restante y registre otro pago parcial.')}</li>
    <li>{l('Retry a reference already in use and an amount greater than the remaining invoice: both must be rejected without a new payment.','Repita una referencia ya utilizada y un importe superior al restante: ambos deben rechazarse sin crear un nuevo pago.')}</li>
    <li>{l('Reverse one payment with a reason; verify the original record remains visible and the remaining amount increases.','Revierta un pago con su motivo; compruebe que el registro original sigue visible y que aumenta el importe sin registrar.')}</li>
    <li>{l('Download the accountant ZIP and inspect supplier-payment-events.csv and supplier-payment-summary.csv. Every entry must say the bank is not verified.','Descargue el ZIP del asesor y revise supplier-payment-events.csv y supplier-payment-summary.csv. Ningún pago debe aparecer como conciliado por el banco.')}</li>
   </ol>
   <p>{l('The database/RLS tests are complete; authenticated browser acceptance is a separate final gate before enabling Production payment registration.','Las pruebas de base de datos y permisos están completas. La aceptación en el navegador con sesión de administrador es un control adicional obligatorio antes de habilitar pagos en Production.')}</p>
  </details>}
  <PaymentForms language={language} mode={mode} yearId={id} payments={rows} overview={overview} money={overview.map(c=>({draft_id:c.draft_id,gross:euro(c.gross_cents),recorded:euro(c.recorded_cents),remaining:euro(c.remaining_unrecorded_cents)}))}/>
 </section>;
}
