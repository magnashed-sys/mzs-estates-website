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
 const t=(en:string,es:string)=>language==='es'?es:en;
 const euro=(cents:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(cents/100);
 const gross=overview.reduce((s,c)=>s+c.gross_cents,0);
 const recorded=overview.reduce((s,c)=>s+c.recorded_cents,0);
 const remaining=gross-recorded;
 return <section className={s.page}>
  <Link href={ADMINISTRATION_ROOT+'/'+id}>← {t('Year administration','Administración anual')}</Link>
  <header className={s.heading}><div><h1>{t('Supplier payment register','Registro de pagos a proveedores')}</h1>
   <p>{source.sales.issuer.name} · {source.administration.fiscal_year}</p></div></header>
  <p className={s.notice}>{t('This is a manual administrative payment record, not a bank feed. Recorded transfers are NOT bank-reconciled, and an unrecorded amount is NOT proof that an invoice is unpaid. No money is transferred from this screen.','Este es un registro manual de pagos, no una conexión bancaria. Los importes registrados NO están conciliados con el banco, y la diferencia sin registrar NO demuestra que la factura esté impagada. Esta pantalla no realiza transferencias.')}</p>
  <div className={s.metrics}>
   <p>{t('Supplier invoice concept totals','Total de borradores de proveedores')}<strong>{euro(gross)}</strong></p>
   <p>{t('Payments manually recorded','Pagos registrados manualmente')}<strong>{euro(recorded)}</strong></p>
   <p>{t('Not matched to a payment entry','Sin anotación de pago')}<strong>{euro(remaining)}</strong></p>
   <p>{t('Bank reconciliation','Conciliación bancaria')}<strong>{t('Not verified','No verificado')}</strong></p>
  </div>
  <p>{t('An administrator can record a partial supplier payment only after reviewing the cost, using an actual payment date and a bank/cash reference. New payment entries cannot exceed the invoice amount; use an explicit correction if a prior registration was incorrect. Excess/advance payments require a separately reviewed workflow.','Un administrador puede registrar pagos parciales después de revisar el coste, con fecha y referencia bancaria o de caja. Los pagos no pueden superar el importe de la factura; una anotación errónea se corrige con una reversión. Los anticipos y sobrepagos requieren un procedimiento adicional.')}</p>
  <PaymentForms language={language} yearId={id} payments={rows} overview={overview} money={overview.map(c=>({draft_id:c.draft_id,gross:euro(c.gross_cents),recorded:euro(c.recorded_cents),remaining:euro(c.remaining_unrecorded_cents)}))}/>
 </section>;
}
