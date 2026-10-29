'use client';
import {useAdminI18n} from '../../../../../../lib/admin/i18n';

import {useActionState,useState} from 'react';
import {initialFormActionState} from '../../../../../../lib/property-operations/form-state';
import {createDraft,issueDraft,cancelDraft} from './actions';
import s from '../sales.module.css';
type Choice={id:string;name:string;address?:string};
export function DraftForm({issuers,customers,requestId,today}:{issuers:Choice[];customers:Choice[];requestId:string;today:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [customer,setCustomer]=useState(''),[count,setCount]=useState(1),[state,action,pending]=useActionState(createDraft,initialFormActionState);
 return <form action={action} className={s.paymentForm}><fieldset disabled={pending}><input type="hidden" name="request_id" value={requestId}/><div className={s.filters}><label>{adminT("Issuing entity")}<select name="issuer_id" required defaultValue=""><option value="" disabled>{adminT("Select entity")}</option>{issuers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>{adminT("Customer")}<select name="customer_id" required value={customer} onChange={e=>setCustomer(e.target.value)}><option value="" disabled>{adminT("Select customer")}</option>{customers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>{adminT("Payment due")}<input name="due_on" type="date" min={today} required/></label></div>
 <label>{adminT("Billing address")}<textarea name="address" key={customer} defaultValue={customers.find(c=>c.id===customer)?.address??''} required minLength={2} maxLength={1000}/></label><p>{adminT("Verify the billing address for this invoice. Customer and entity names are copied from their registered profiles.")}</p>
 <div className={s.filters}><label>{adminT("Attention")}<input name="attention" maxLength={200}/></label><label>{adminT("Customer tax ID")}<input name="tax_id" maxLength={100}/></label><label>{adminT("Customer reference")}<input name="reference" maxLength={200}/></label></div><label>{adminT("Invoice subject")}<input name="subject" required minLength={2} maxLength={300}/></label>
 <h2>{adminT("Invoice lines")}</h2>{Array.from({length:count},(_,i)=><div key={i} className={s.filters}><label>{adminT("Description")}<input name="description" required minLength={2} maxLength={1000}/></label><label>{adminT("Quantity")}<input name="quantity" required inputMode="decimal" defaultValue="1" pattern="[0-9]+([.,][0-9]{1,3})?"/></label><label>{adminT("Unit price excl. VAT (€)")}<input name="unit_price" required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?"/></label><label>{adminT("VAT % or exempt")}<input name="vat" required placeholder={adminT("21 or exempt")} pattern="([0-9]{1,2}([.,][0-9]{1,2})?|exempt)"/></label></div>)}
 <button type="button" className={s.button} disabled={count>=30} onClick={()=>setCount(count+1)}>{adminT("Add line")}</button>{count>1&&<button type="button" onClick={()=>setCount(count-1)}>{adminT("Remove last line")}</button>}
 <label>{adminT("Payment instructions / terms")}<textarea name="terms" maxLength={1000}/></label><p>{adminT("VAT is your explicit selection. Amounts are rounded per line to euro cents. Saving creates a reviewable draft without consuming a number or sending an email.")}</p><button className={s.button} disabled={pending}>{pending?adminT("Saving…"):adminT("Save draft for review")}</button></fieldset>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
export function IssueForm({id}:{id:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
const [state,action,pending]=useActionState(issueDraft,initialFormActionState);return <form action={action}><input type="hidden" name="draft_id" value={id}/><label className={s.confirm}><input type="checkbox" name="confirmed" value="yes" required disabled={pending}/>{adminT("I checked the customer, issuer, lines, VAT, due date and PDF. Issue this immutable invoice with the next entity invoice number.")}</label><button className={s.button} disabled={pending}>{pending?adminT("Issuing…"):adminT("Issue invoice")}</button>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;}
export function CancelForm({id}:{id:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
const [state,action,pending]=useActionState(cancelDraft,initialFormActionState);return <details><summary>{adminT("Cancel draft")}</summary><form action={action}><input type="hidden" name="draft_id" value={id}/><label>{adminT("Reason")}<input name="reason" required minLength={8} maxLength={500}/></label><label><input type="checkbox" name="confirmed" value="yes" required/>{adminT("Cancel this draft, retaining its history.")}</label><button disabled={pending}>{adminT("Cancel draft")}</button>{state.message&&<p role="status">{adminT(state.message)}</p>}</form></details>;}
