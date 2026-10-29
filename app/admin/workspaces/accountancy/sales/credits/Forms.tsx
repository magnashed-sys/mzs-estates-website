'use client';
import {useAdminI18n} from '../../../../../../lib/admin/i18n';

import {useActionState} from 'react';
import {initialFormActionState} from '../../../../../../lib/property-operations/form-state';
import {createCreditDraft,issueCredit} from './actions';
import s from '../sales.module.css';
export function CreditForm({invoiceId,requestId,lines}:{invoiceId:string;requestId:string;lines:{description:string;remaining:number}[]}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,action,pending]=useActionState(createCreditDraft,initialFormActionState);
 return <form action={action} className={s.paymentForm}><fieldset disabled={pending}><input type="hidden" name="invoice_id" value={invoiceId}/><input type="hidden" name="request_id" value={requestId}/>{lines.map((l,index)=><div key={index} className={s.filters}><label>{l.description}<small>{adminT("Available net credit: EUR")} {(l.remaining/100).toFixed(2)}</small><input name="net" inputMode="decimal" defaultValue={(l.remaining/100).toFixed(2)} required pattern="[0-9]+([.,][0-9]{1,2})?"/></label></div>)}<p>{adminT("Enter 0 to leave a line unchanged. VAT is calculated from the original line and previous credits. The default amounts credit the remaining invoice in full.")}</p><div className={s.filters}><label>{adminT("Reason")}<textarea name="reason" required minLength={8} maxLength={500} rows={3}/></label></div><button className={s.button}>{pending?adminT("Preparing…"):adminT("Review credit preview")}</button></fieldset>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
export function IssueCreditForm({id}:{id:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
const [state,action,pending]=useActionState(issueCredit,initialFormActionState);return <form action={action} className={s.paymentForm}><fieldset disabled={pending}><input type="hidden" name="draft_id" value={id}/><label className={s.confirm}><input type="checkbox" name="confirmed" value="yes" required/>{adminT("I reviewed the original invoice, reason, amounts and VAT. Issue this permanent credit note and allocate it to the original invoice.")}</label><button className={s.button}>{pending?adminT("Issuing…"):adminT("Issue credit note")}</button></fieldset>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;}
