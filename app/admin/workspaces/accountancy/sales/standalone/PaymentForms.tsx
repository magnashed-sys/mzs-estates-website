'use client';
import {useAdminI18n} from '../../../../../../lib/admin/i18n';

import {useActionState,useState} from 'react';
import {initialFormActionState} from '../../../../../../lib/property-operations/form-state';
import {recordExternalReceipt,reverseExternalReceipt} from './actions';
import s from '../sales.module.css';
export function PaymentForm({invoiceId,requestId,remaining,today,source='external'}:{source?:'external'|'archive'|'service';invoiceId:string;requestId:string;remaining:number;today:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [key,setKey]=useState(requestId);
 const [state,submit,pending]=useActionState(async(previous:typeof initialFormActionState,data:FormData)=>{const result=await recordExternalReceipt(previous,data);if(result.status==='success')setKey(crypto.randomUUID());return result;},initialFormActionState);
 return <form action={submit} className={s.paymentForm}><h2>{adminT("Record received payment")}</h2><p>{adminT("Enter an actual receipt from your bank statement. This records the payment; it does not collect money or notify the customer.")}</p><fieldset disabled={pending||remaining<=0}>
  <input type="hidden" name="source" value={source}/><input type="hidden" name="invoice_id" value={invoiceId}/><input type="hidden" name="request_id" value={key}/>
  <div className={s.filters}><label>{adminT("Amount received (€)")}<input name="amount" inputMode="decimal" required pattern="[0-9]+([.,][0-9]{1,2})?" placeholder="0.00" aria-describedby="receipt-limit"/></label><label>{adminT("Received on")}<input name="received_on" type="date" min="2000-01-01" max={today} required defaultValue={today}/></label><label>{adminT("Bank reference")}<input name="reference" minLength={3} maxLength={200} required placeholder={adminT("Unique transaction reference")}/></label></div>
  <p id="receipt-limit">{adminT("Maximum remaining amount:")} {new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(remaining/100)}.</p>
  <label className={s.confirm}><input type="checkbox" name="confirmed" value="yes" required/>{adminT("I checked this receipt against my bank statement and it has not already been recorded")}{source==='archive'?adminT(" or included in the imported paid amount"):''}.</label>
  <button className={s.button} disabled={pending||remaining<=0}>{pending?adminT("Saving…"):adminT("Record payment")}</button>
 </fieldset>{remaining<=0&&<p>{adminT("This invoice is fully paid according to the recorded receipts.")}</p>}{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
export function ReversalForm({invoiceId,receiptId,source='external'}:{source?:'external'|'archive'|'service';invoiceId:string;receiptId:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,submit,pending]=useActionState(reverseExternalReceipt,initialFormActionState);
 return <details className={s.reversal}><summary>{adminT("Correct this payment registration")}</summary><form action={submit}><fieldset disabled={pending}><input type="hidden" name="source" value={source}/><input type="hidden" name="invoice_id" value={invoiceId}/><input type="hidden" name="receipt_id" value={receiptId}/><label>{adminT("Reason")}<textarea name="reason" required minLength={8} maxLength={500} rows={3}/></label><label className={s.confirm}><input type="checkbox" name="confirmed" value="yes" required/>{adminT("Reverse this registration while keeping its history. This is not a bank refund.")}</label><button className={s.button} disabled={pending}>{pending?adminT("Saving…"):adminT("Reverse registration")}</button></fieldset>{state.message&&<p role="status">{adminT(state.message)}</p>}</form></details>;
}
