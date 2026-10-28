'use client';
import {useActionState,useState,type ReactNode} from 'react';
import {initialFormActionState} from '../../lib/property-operations/form-state';
import {type WorkState,type Visit,type Ticket,type Member,statusLabels,transitions} from '../../lib/property-operations/staff-work';
import {reviewActualVisit,decideCorrection,recordTicketProgress} from '../admin/workspaces/estates/staff/review-actions';
import {requestVisitCorrection} from './correction-actions';
import s from './staff.module.css';
function ActionForm({action,children,label}:{action:(state:WorkState,form:FormData)=>Promise<WorkState>;children:ReactNode;label:string}){
 const [state,submit,pending]=useActionState(action,initialFormActionState);
 return <form action={submit} className={s.form}>{children}<button disabled={pending}>{pending?"Saving…":label}</button>{state.message&&<p role="status" className={state.status==='error'?s.error:s.confirm}>{state.message}</p>}</form>;
}
function Reason(){return <label>Explanation (visible to staff member)<textarea name="reason" minLength={8} maxLength={1000} required rows={3}/></label>;}
export function ReviewForm({visit}:{visit:Visit}){
 const [decision,setDecision]=useState('approved'),[billing,setBilling]=useState(false);
 return <ActionForm action={reviewActualVisit} label="Record review"><h3>Review time · {visit.effective_minutes} minutes</h3>
 <input type="hidden" name="visit_id" value={visit.id}/><input type="hidden" name="correction_id" value={visit.correction_id??''}/>
 <label>Decision<select name="decision" value={decision} onChange={e=>setDecision(e.target.value)}><option value="approved">Approve</option><option value="rejected">Return with explanation</option></select></label><Reason/>
 <label>Recharge<select name="recharge_class" value={decision==='approved'&&billing?'review_candidate':'not_billable'} onChange={e=>setBilling(e.target.value==='review_candidate')}><option value="not_billable">No recharge proposal</option>{decision==='approved'&&<option value="review_candidate">Separate minute proposal</option>}</select></label>
 {decision==='approved'&&billing&&<><p>Proposal only; actual worked minutes remain {visit.effective_minutes}. No rate or invoice is calculated.</p><label>Minimum minutes<input type="number" name="minimum_minutes" min={0} max={960} required/></label><label>Round in minute increments<input type="number" name="increment_minutes" min={1} max={960} required/></label></>}
 </ActionForm>;
}
export function CorrectionForm({visit}:{visit:Visit}){return <ActionForm action={requestVisitCorrection} label="Request correction"><h3>Correct minutes</h3><input type="hidden" name="visit_id" value={visit.id}/><label>Correct total minutes<input type="number" name="proposed_minutes" min={1} max={960} defaultValue={visit.effective_minutes} required/></label><label>Reason<textarea name="reason" minLength={10} maxLength={1000} rows={3} required/></label></ActionForm>;}
export function CorrectionDecisionForm({id}:{id:string}){return <ActionForm action={decideCorrection} label="Review correction"><input type="hidden" name="correction_id" value={id}/><label>Decision<select name="decision"><option value="approved">Approve correction</option><option value="rejected">Reject correction</option></select></label><Reason/></ActionForm>;}
export function TicketProgressForm({ticket,members}:{ticket:Ticket;members:Member[]}){return <ActionForm action={recordTicketProgress} label="Update maintenance"><h3>Follow-up and planning</h3><input type="hidden" name="ticket_id" value={ticket.id}/><input type="hidden" name="expected_event_id" value={ticket.latest_event_id??''}/><label>New status<select name="action">{transitions[ticket.status]?.map(a=><option key={a} value={a}>{statusLabels[a]}</option>)}</select></label><label>Assignee<select name="responsible_profile_id" defaultValue={ticket.responsible_profile_id??''}><option value="">Not yet assigned</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name??"Unnamed account"}</option>)}</select></label><label>Scheduled date<input name="scheduled_for" type="date" defaultValue={ticket.scheduled_for??''}/></label><label>Explanation (visible to reporter)<textarea name="note" minLength={8} maxLength={1000} rows={3} required/></label></ActionForm>;}
