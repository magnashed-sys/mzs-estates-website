'use client';
import {useAdminI18n} from '../../lib/admin/i18n';

import {useActionState,useState,type ReactNode} from 'react';
import {initialFormActionState} from '../../lib/property-operations/form-state';
import {type WorkState,type Visit,type Ticket,type Member,statusLabels,transitions} from '../../lib/property-operations/staff-work';
import {reviewActualVisit,decideCorrection,recordTicketProgress} from '../admin/workspaces/estates/staff/review-actions';
import {requestVisitCorrection} from './correction-actions';
import s from './staff.module.css';
function ActionForm({action,children,label}:{action:(state:WorkState,form:FormData)=>Promise<WorkState>;children:ReactNode;label:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [state,submit,pending]=useActionState(action,initialFormActionState);
 return <form action={submit} className={s.form}>{children}<button disabled={pending}>{pending?adminT("Saving…"):adminT(label)}</button>{state.message&&<p role="status" className={state.status==='error'?s.error:s.confirm}>{adminT(state.message)}</p>}</form>;
}
function Reason(){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <label>{adminT("Explanation (visible to staff member)")}<textarea name="reason" minLength={8} maxLength={1000} required rows={3}/></label>;}
export function ReviewForm({visit}:{visit:Visit}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const zorgbalans=visit.work_area_id==='zorgbalans';
 const [decision,setDecision]=useState('approved'),[billing,setBilling]=useState(false);
 return <ActionForm action={reviewActualVisit} label={adminT("Record review")}><h3>{adminT("Review time ·")} {visit.effective_minutes}  {adminT("minutes")}</h3>
 <input type="hidden" name="visit_id" value={visit.id}/><input type="hidden" name="correction_id" value={visit.correction_id??''}/>
 <label>{adminT("Decision")}<select name="decision" value={decision} onChange={e=>setDecision(e.target.value)}><option value="approved">{adminT("Approve")}</option><option value="rejected">{adminT("Return with explanation")}</option></select></label><Reason/>
 {zorgbalans&&<p>{adminT("Zorgbalans hours are recharged through the separate private billing workflow after approval.")}</p>}
 <label>{adminT("Recharge")}<select name="recharge_class" value={zorgbalans?'not_billable':decision==='approved'&&billing?'review_candidate':'not_billable'} disabled={zorgbalans} onChange={e=>setBilling(e.target.value==='review_candidate')}><option value="not_billable">{adminT("No recharge proposal")}</option>{decision==='approved'&&!zorgbalans&&<option value="review_candidate">{adminT("Separate minute proposal")}</option>}</select></label>
 {zorgbalans&&<input type="hidden" name="recharge_class" value="not_billable"/>}
 {decision==='approved'&&billing&&!zorgbalans&&<><p>{adminT("Proposal only; actual worked minutes remain")} {visit.effective_minutes}{adminT(". No rate or invoice is calculated.")}</p><label>{adminT("Minimum minutes")}<input type="number" name="minimum_minutes" min={0} max={960} required/></label><label>{adminT("Round in minute increments")}<input type="number" name="increment_minutes" min={1} max={960} required/></label></>}
 </ActionForm>;
}
export function CorrectionForm({visit}:{visit:Visit}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <ActionForm action={requestVisitCorrection} label={adminT("Request correction")}><h3>{adminT("Correct minutes")}</h3><input type="hidden" name="visit_id" value={visit.id}/><label>{adminT("Correct total minutes")}<input type="number" name="proposed_minutes" min={1} max={960} defaultValue={visit.effective_minutes} required/></label><label>{adminT("Reason")}<textarea name="reason" minLength={10} maxLength={1000} rows={3} required/></label></ActionForm>;}
export function CorrectionDecisionForm({id}:{id:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <ActionForm action={decideCorrection} label={adminT("Review correction")}><input type="hidden" name="correction_id" value={id}/><label>{adminT("Decision")}<select name="decision"><option value="approved">{adminT("Approve correction")}</option><option value="rejected">{adminT("Reject correction")}</option></select></label><Reason/></ActionForm>;}
export function TicketProgressForm({ticket,members}:{ticket:Ticket;members:Member[]}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <ActionForm action={recordTicketProgress} label={adminT("Update maintenance")}><h3>{adminT("Follow-up and planning")}</h3><input type="hidden" name="ticket_id" value={ticket.id}/><input type="hidden" name="expected_event_id" value={ticket.latest_event_id??''}/><label>{adminT("New status")}<select name="action">{transitions[ticket.status]?.map(a=><option key={a} value={a}>{adminT(statusLabels[a])}</option>)}</select></label><label>{adminT("Assignee")}<select name="responsible_profile_id" defaultValue={ticket.responsible_profile_id??''}><option value="">{adminT("Not yet assigned")}</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name??adminT("Unnamed account")}</option>)}</select></label><label>{adminT("Scheduled date")}<input name="scheduled_for" type="date" defaultValue={ticket.scheduled_for??''}/></label><label>{adminT("Explanation (visible to reporter)")}<textarea name="note" minLength={8} maxLength={1000} rows={3} required/></label></ActionForm>;}
