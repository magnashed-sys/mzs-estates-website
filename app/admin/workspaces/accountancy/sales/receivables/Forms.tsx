'use client';
import {useAdminI18n} from '../../../../../../lib/admin/i18n';

import {useActionState,useState} from 'react';
import {initialFormActionState} from '../../../../../../lib/property-operations/form-state';
import {saveFollowUp,sendReminder} from './actions';
import s from '../sales.module.css';
export function FollowUpForm({source,invoiceId,requestId,revision,nextOn}:{source:string;invoiceId:string;requestId:string;revision:number;nextOn:string|null}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [key,setKey]=useState(requestId);
 const [state,action,pending]=useActionState(async(previous:typeof initialFormActionState,data:FormData)=>{const result=await saveFollowUp(previous,data);if(result.status==='success')setKey(crypto.randomUUID());return result;},initialFormActionState);
 return <form action={action} className={s.paymentForm}><h2>{adminT("Internal follow-up")}</h2><fieldset disabled={pending}><input type="hidden" name="source" value={source}/><input type="hidden" name="invoice_id" value={invoiceId}/><input type="hidden" name="request_id" value={key}/><input type="hidden" name="revision" value={revision}/><div className={s.filters}><label>{adminT("New internal note")}<textarea name="note" required minLength={3} maxLength={2000} rows={4}/></label><label>{adminT("Next follow-up")}<input type="date" name="next_on" defaultValue={nextOn??''} min="2000-01-01" max="2099-12-31"/></label></div><p>{adminT("Leave the date blank to clear the planned follow-up. Saving a note does not change payment status or send a message.")}</p><button className={s.button}>{pending?adminT("Saving…"):adminT("Save follow-up")}</button></fieldset>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
export function ReminderForm({source,invoiceId,requestId,preview,enabled}:{source:string;invoiceId:string;requestId:string;preview:string;enabled:boolean}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,action,pending]=useActionState(sendReminder,initialFormActionState);
 return <form action={action}><fieldset disabled={pending||!enabled||state.status==='success'}><input type="hidden" name="source" value={source}/><input type="hidden" name="invoice_id" value={invoiceId}/><input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="preview" value={preview}/><label className={s.confirm}><input type="checkbox" required name="confirmed" value="yes"/>{adminT("I verified the recipient and balance against recent payments and approve sending this exact reminder.")}</label><button className={s.button}>{pending?adminT("Sending…"):adminT("Send this reminder")}</button></fieldset>{state.message&&<p role="status">{adminT(state.message)}</p>}</form>;
}
