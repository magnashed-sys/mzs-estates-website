import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../../../lib/admin/i18n-server';
import {annualSource} from '../../../../../../../lib/accountancy/administration-data';
import {uuid,ADMINISTRATION_ROOT} from '../../../../../../../lib/accountancy/administration';
import {supplierPaymentEnvironment,supplierPaymentRows,paymentOverview} from '../../../../../../../lib/accountancy/supplier-payments';
import {PaymentForms} from './PaymentForms';
import s from '../../administration.module.css';
export const dynamic='force-dynamic';
export default async function SupplierPayments({params}:{params:Promise<{id:string}>}){
 if(!supplierPaymentEnvironment())notFound();
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
  <header className={s.heading}><div><h1>{l('Supplier payment register','Registro de pagos a proveedores')}</h1>
   <p>{source.sales.issuer.name} · {source.administration.fiscal_year}</p></div></header>
  <p className={s.notice}>{l('This is a manual administrative payment record, not a bank feed. Recorded transfers are NOT bank-reconciled, and an unrecorded amount is NOT proof that an invoice is unpaid. No money is transferred from this screen.','Este es un registro manual de pagos, no una conexión bancaria. Los importes registrados NO están conciliados con el banco, y la diferencia sin registrar NO demuestra que la factura esté impagada. Esta pantalla no realiza transferencias.')}</p>
  <div className={s.metrics}>
   <p>{l('Supplier invoice concept totals','Total de borradores de proveedores')}<strong>{euro(gross)}</strong></p>
   <p>{l('Payments manually recorded','Pagos registrados manualmente')}<strong>{euro(recorded)}</strong></p>
   <p>{l('Not matched to a payment entry','Sin anotación de pago')}<strong>{euro(remaining)}</strong></p>
   <p>{l('Bank reconciliation','Conciliación bancaria')}<strong>{l('Not verified','No verificado')}</strong></p>
  </div>
  <p>{l('An administrator can record a partial supplier payment only after reviewing the cost, using an actual payment date and a bank/cash reference. New payment entries cannot exceed the invoice amount; use an explicit correction if a prior registration was incorrect. Excess/advance payments require a separately reviewed workflow.','Un administrador puede registrar pagos parciales después de revisar el coste, con fecha y referencia bancaria o de caja. Los pagos no pueden superar el importe de la factura; una anotación errónea se corrige con una reversión. Los anticipos y sobrepagos requieren un procedimiento adicional.')}</p>
  <details className={s.panel}><summary>{l('Staging acceptance checklist','Lista de comprobación de Staging')}</summary>
   <p>{l('Use only synthetic test payment references and the existing synthetic invoice. This pilot is not Production and must never be used for a real transfer.','Utilice exclusivamente referencias de pago de prueba y la factura ficticia existente. Este piloto no es Production y nunca debe utilizarse para una transferencia real.')}</p>
   <ol>
    <li>{l('Open the annual cost review and mark only the synthetic invoice Reviewed with a synthetic evidence reference.','Abra la revisión de costes del ejercicio y marque solo la factura ficticia como revisada con una referencia de prueba.')}</li>
    <li>{l('Record a first partial payment, confirm the current remaining amount, then record a second partial payment.','Registre un primer pago parcial, compruebe el importe restante y registre otro pago parcial.')}</li>
    <li>{l('Retry a reference already in use and an amount greater than the remaining invoice: both must be rejected without a new payment.','Repita una referencia ya utilizada y un importe superior al restante: ambos deben rechazarse sin crear un nuevo pago.')}</li>
    <li>{l('Reverse one payment with a reason; verify the original record remains visible and the remaining amount increases.','Revierta un pago con su motivo; compruebe que el registro original sigue visible y que aumenta el importe sin registrar.')}</li>
    <li>{l('Download the accountant ZIP and inspect supplier-payment-events.csv and supplier-payment-summary.csv. Every entry must say the bank is not verified.','Descargue el ZIP del asesor y revise supplier-payment-events.csv y supplier-payment-summary.csv. Ningún pago debe aparecer como conciliado por el banco.')}</li>
   </ol>
   <p>{l('The database/RLS tests are complete; authenticated browser acceptance is a separate final gate before enabling Production payment registration.','Las pruebas de base de datos y permisos están completas. La aceptación en el navegador con sesión de administrador es un control adicional obligatorio antes de habilitar pagos en Production.')}</p>
  </details>
  <PaymentForms language={language} yearId={id} payments={rows} overview={overview} money={overview.map(c=>({draft_id:c.draft_id,gross:euro(c.gross_cents),recorded:euro(c.recorded_cents),remaining:euro(c.remaining_unrecorded_cents)}))}/>
 </section>;
}
