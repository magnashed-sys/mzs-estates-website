'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {recordSupplierPayment,reverseSupplierPayment,type PaymentAction} from './actions';
import type {CostPaymentOverview,SupplierPaymentRecord,SupplierPaymentMode} from '../../../../../../../lib/accountancy/supplier-payments';
import s from '../../administration.module.css';
type Language='en'|'es';
type Amounts={draft_id:string;gross:string;recorded:string;remaining:string};
const text=(language:Language,en:string,es:string)=>language==='es'?es:en;
function errorMessage(language:Language,result:PaymentAction){
 switch(result.code){
  case 'invalid':return text(language,'Check the amount, date, invoice and reference.','Revise el importe, fecha, factura y referencia.');
  case 'review_required':return text(language,'Review the supplier cost before recording a payment.','Revise el coste antes de registrar un pago.');
  case 'exceeds':return text(language,'Payment exceeds the amount not yet recorded against this invoice.','El pago supera el importe aún no registrado de esta factura.');
  case 'duplicate':return text(language,'This payment reference is already active for this invoice.','Esta referencia de pago ya existe para la factura.');
  case 'reversed':return text(language,'This payment was already reversed. Refresh the page.','El pago ya fue revertido. Actualice la página.');
  default:return text(language,'Payment could not be saved. Refresh before retrying.','No se pudo registrar el pago. Actualice la página antes de reintentar.');
 }
}
function RecordForm({yearId,item,language,mode}:{yearId:string;item:CostPaymentOverview;language:Language;mode:SupplierPaymentMode}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),lock=useRef(false),requestId=useRef<string|null>(null),router=useRouter();
 const permitted=item.review_status==='reviewed'&&item.remaining_unrecorded_cents>0;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(lock.current||!permitted)return;
  lock.current=true;setBusy(true);setNotice('');
  const form=e.currentTarget,f=new FormData(form);
  requestId.current??=crypto.randomUUID();
  f.set('request_id',requestId.current);f.set('draft_id',item.draft_id);f.set('year_id',yearId);
  try{
   const result=await recordSupplierPayment(f);
   if(result.ok){requestId.current=null;setNotice(mode==='synthetic'?text(language,'Synthetic payment test recorded in Staging. No real money has moved.','Pago ficticio registrado en Staging. No se ha transferido dinero real.'):text(language,'Existing supplier payment recorded administratively. Bank reconciliation is NOT verified.','Pago ya realizado registrado administrativamente. La conciliación bancaria NO está verificada.'));form.reset();router.refresh();}
   else setNotice(errorMessage(language,result));
  }catch{setNotice(text(language,'The request could not be confirmed. Refresh and check the payment history before repeating.','No se pudo confirmar la solicitud. Compruebe el historial antes de repetirla.'));}
  finally{lock.current=false;setBusy(false);}
 }
 return <details className={s.panel}><summary>{mode==='synthetic'?text(language,'Record a synthetic partial or full payment','Registrar un pago ficticio parcial o total'):text(language,'Record an existing supplier payment','Registrar un pago ya realizado a un proveedor')}</summary>
  {!permitted&&<p role="status">{item.review_status!=='reviewed'?text(language,'Cost review is required before payment registration.','Es necesario revisar el coste antes de registrar pagos.'):text(language,'The invoice is fully covered by recorded entries.','El importe de la factura ya está cubierto por las anotaciones registradas.')}</p>}
  <p><Link href={'/admin/workspaces/accountancy/administrations/'+yearId+'#costs'}>{text(language,'Open cost review','Abrir revisión de costes')}</Link>{' · '}<Link href={'/admin/workspaces/accountancy/documents/links/cost/'+item.draft_id}>{text(language,'Check original invoice PDF','Revisar PDF original de la factura')}</Link></p>
  <form onSubmit={submit}><fieldset className={s.form} disabled={busy||!permitted}>
   <label>{mode==='synthetic'?text(language,'Synthetic amount (EUR)','Importe ficticio (EUR)'):text(language,'Existing payment amount (EUR)','Importe del pago ya realizado (EUR)')}<input name="amount_eur" inputMode="decimal" placeholder="0.00" maxLength={20} required/></label>
   <label>{mode==='synthetic'?text(language,'Simulated payment date','Fecha de pago simulada'):text(language,'Actual payment date','Fecha real del pago')}<input name="paid_on" type="date" required/></label>
   <label className={s.wide}>{mode==='synthetic'?text(language,'Synthetic test reference','Referencia ficticia de prueba'):text(language,'Bank/cash source reference','Referencia bancaria o de caja')}<input name="reference" minLength={3} maxLength={200} required autoComplete="off"/></label>
   <label className={s.wide+" "+s.check}>{mode==='synthetic'?<><input type="checkbox" name="confirmed_synthetic_staging_test" value="yes" required/>{text(language,'I confirm this is a FICTITIOUS STAGING TEST. No bank transfer or cash payment actually happened; these figures must never be treated as real expenses or payments.','Confirmo que esta es una PRUEBA FICTICIA EN STAGING. No se ha realizado ninguna transferencia ni pago real; estos importes nunca deben tratarse como gastos o pagos reales.')}</>:<><input type="checkbox" name="confirmed_existing_transfer" value="yes" required/>{text(language,'I have verified this amount was ALREADY transferred or paid in cash on the date entered, and have checked the source reference. Saving will only record the entry, never transfer funds or certify bank reconciliation.','He comprobado que este importe YA se transfirió o pagó en efectivo en la fecha indicada y he verificado la referencia. Guardar solo registra la anotación, nunca transfiere fondos ni certifica la conciliación bancaria.')}</>}</label>
   <p className={s.wide}>{mode==='synthetic'?text(language,'This pilot records synthetic test history only, with no bank movement, VAT treatment or statutory posting.','Este piloto solo registra datos de prueba ficticios, sin movimientos bancarios, tratamiento de IVA ni contabilización oficial.'):text(language,'This records an existing payment entry only. Confirm actual evidence before saving; bank reconciliation, VAT treatment and accounting posting remain separate.','Esto solo anota un pago ya realizado. Compruebe el justificante antes de guardar; la conciliación bancaria, el IVA y la contabilización siguen siendo procedimientos independientes.')}</p>
   <button className={s.button} disabled={busy||!permitted}>{busy?text(language,'Saving…','Guardando…'):mode==='synthetic'?text(language,'Save synthetic test payment','Guardar pago ficticio de prueba'):text(language,'Record existing payment','Registrar pago ya realizado')}</button>
  </fieldset></form>{notice&&<p role="status">{notice}</p>}
 </details>;
}
function ReverseForm({yearId,record,language,mode}:{yearId:string;record:SupplierPaymentRecord;language:Language;mode:SupplierPaymentMode}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),lock=useRef(false),router=useRouter();
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  const f=new FormData(e.currentTarget);f.set('payment_id',record.id);f.set('draft_id',record.draft_id);f.set('year_id',yearId);
  try{const result=await reverseSupplierPayment(f);if(result.ok){setNotice(mode==='synthetic'?text(language,'Synthetic Staging correction recorded. No bank refund occurred.','Corrección ficticia registrada en Staging. No se realizó ningún reembolso bancario.'):text(language,'Administrative correction recorded. This does not mean a bank refund happened.','Corrección administrativa registrada. No implica que se haya producido un reembolso bancario.'));router.refresh();}else setNotice(errorMessage(language,result));}
  catch{setNotice(text(language,'Reversal could not be confirmed; refresh before retrying.','No se pudo confirmar la reversión; actualice antes de repetirla.'));}
  finally{lock.current=false;setBusy(false);}
 }
 return <details><summary>{text(language,'Correct this entry','Corregir esta anotación')}</summary>
  <form onSubmit={submit} className={s.form}>
   <label className={s.wide}>{text(language,'Reversal reason (8–500 characters)','Motivo de reversión (8–500 caracteres)')}<textarea name="reason" minLength={8} maxLength={500} rows={2} required disabled={busy}/></label>
   <button className={s.button} disabled={busy}>{busy?text(language,'Saving…','Guardando…'):text(language,'Record reversal','Registrar reversión')}</button>
  </form>{notice&&<p role="status">{notice}</p>}
 </details>;
}
export function PaymentForms({language,yearId,overview,payments,money,mode}:{
 language:Language;mode:SupplierPaymentMode;yearId:string;overview:CostPaymentOverview[];
 payments:SupplierPaymentRecord[];money:Amounts[];
}){
 const moneyById=new Map(money.map(x=>[x.draft_id,x]));
 const currency=(value:number)=>new Intl.NumberFormat(language==='es'?'es-ES':'en-GB',{style:'currency',currency:'EUR'}).format(value/100);
 return <div>
  {overview.map(item=>{
   const amounts=moneyById.get(item.draft_id),events=payments.filter(p=>p.draft_id===item.draft_id);
   return <section key={item.draft_id} className={s.panel}>
    <h2>{item.invoice_number}</h2>
    <p>{text(language,'Total','Total')}: {amounts?.gross} · {text(language,'Administratively recorded','Registrado administrativamente')}: {amounts?.recorded} · {text(language,'Without a matching entry','Sin anotación de pago')}: {amounts?.remaining}</p>
    <p>{text(language,'Cost review','Revisión del coste')}: {item.review_status} · {text(language,'Bank verified (test only)','Verificado por banco (solo prueba)')}: {text(language,'No','No')}</p>
    <RecordForm key={item.draft_id+'-'+item.recorded_cents} item={item} language={language} yearId={yearId} mode={mode}/>
    {!!events.length&&<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{text(language,'Date','Fecha')}</th><th>{text(language,'Amount','Importe')}</th><th>{text(language,'Reference','Referencia')}</th><th>{text(language,'Administrative status','Estado administrativo')}</th></tr></thead>
    <tbody>{events.map(p=><tr key={p.id}><td>{p.paid_on}</td><td>{currency(p.amount_cents)}</td><td>{p.reference}</td><td>{p.reversed_at?
     <span>{text(language,'Reversed','Revertido')} · {p.reversal_reason}</span>:
     <><span>{mode==='synthetic'?text(language,'Synthetic test record, not bank-verified','Registro ficticio sin conciliación bancaria'):text(language,'Existing payment recorded, not bank-reconciled','Pago existente anotado, no conciliado')}</span><ReverseForm language={language} yearId={yearId} record={p} mode={mode}/></>}
    </td></tr>)}</tbody></table></div>}
   </section>;
  })}
  {!overview.length&&<p>{text(language,'No supplier cost concepts for this year.','No hay borradores de proveedores para este ejercicio.')}</p>}
 </div>;
}
