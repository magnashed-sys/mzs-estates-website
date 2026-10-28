'use client';
import {useActionState,useState,type ReactNode} from 'react';
import {initialFormActionState} from '../../lib/property-operations/form-state';
import {type WorkState,type Visit,type Ticket,type Member,statusLabels,transitions} from '../../lib/property-operations/staff-work';
import {reviewActualVisit,decideCorrection,recordTicketProgress} from '../admin/workspaces/estates/staff/review-actions';
import {requestVisitCorrection} from './correction-actions';
import s from './staff.module.css';
function ActionForm({action,children,label}:{action:(state:WorkState,form:FormData)=>Promise<WorkState>;children:ReactNode;label:string}){
 const [state,submit,pending]=useActionState(action,initialFormActionState);
 return <form action={submit} className={s.form}>{children}<button disabled={pending}>{pending?'Opslaan…':label}</button>{state.message&&<p role="status" className={state.status==='error'?s.error:s.confirm}>{state.message}</p>}</form>;
}
function Reason(){return <label>Toelichting (zichtbaar voor medewerker)<textarea name="reason" minLength={8} maxLength={1000} required rows={3}/></label>;}
export function ReviewForm({visit}:{visit:Visit}){
 const [decision,setDecision]=useState('approved'),[billing,setBilling]=useState(false);
 return <ActionForm action={reviewActualVisit} label="Beoordeling vastleggen"><h3>Uren beoordelen · {visit.effective_minutes} minuten</h3>
 <input type="hidden" name="visit_id" value={visit.id}/><input type="hidden" name="correction_id" value={visit.correction_id??''}/>
 <label>Beslissing<select name="decision" value={decision} onChange={e=>setDecision(e.target.value)}><option value="approved">Goedkeuren</option><option value="rejected">Terugsturen met toelichting</option></select></label><Reason/>
 <label>Doorbelasting<select name="recharge_class" value={decision==='approved'&&billing?'review_candidate':'not_billable'} onChange={e=>setBilling(e.target.value==='review_candidate')}><option value="not_billable">Geen doorbelastingsvoorstel</option>{decision==='approved'&&<option value="review_candidate">Afzonderlijk minutenvoorstel</option>}</select></label>
 {decision==='approved'&&billing&&<><p>Uitsluitend een voorstel; de gewerkte minuten blijven {visit.effective_minutes}. Er wordt geen tarief of factuur berekend.</p><label>Minimum minuten<input type="number" name="minimum_minutes" min={0} max={960} required/></label><label>Afronden in stappen van minuten<input type="number" name="increment_minutes" min={1} max={960} required/></label></>}
 </ActionForm>;
}
export function CorrectionForm({visit}:{visit:Visit}){return <ActionForm action={requestVisitCorrection} label="Correctie aanvragen"><h3>Minuten corrigeren</h3><input type="hidden" name="visit_id" value={visit.id}/><label>Juiste totale minuten<input type="number" name="proposed_minutes" min={1} max={960} defaultValue={visit.effective_minutes} required/></label><label>Reden<textarea name="reason" minLength={10} maxLength={1000} rows={3} required/></label></ActionForm>;}
export function CorrectionDecisionForm({id}:{id:string}){return <ActionForm action={decideCorrection} label="Correctie beoordelen"><input type="hidden" name="correction_id" value={id}/><label>Beslissing<select name="decision"><option value="approved">Correctie goedkeuren</option><option value="rejected">Correctie afwijzen</option></select></label><Reason/></ActionForm>;}
export function TicketProgressForm({ticket,members}:{ticket:Ticket;members:Member[]}){return <ActionForm action={recordTicketProgress} label="Onderhoud bijwerken"><h3>Opvolging en planning</h3><input type="hidden" name="ticket_id" value={ticket.id}/><input type="hidden" name="expected_event_id" value={ticket.latest_event_id??''}/><label>Nieuwe status<select name="action">{transitions[ticket.status]?.map(a=><option key={a} value={a}>{statusLabels[a]}</option>)}</select></label><label>Verantwoordelijke<select name="responsible_profile_id" defaultValue={ticket.responsible_profile_id??''}><option value="">Nog niet toegewezen</option>{members.map(m=><option key={m.id} value={m.id}>{m.full_name??'Account zonder naam'}</option>)}</select></label><label>Geplande datum<input name="scheduled_for" type="date" defaultValue={ticket.scheduled_for??''}/></label><label>Toelichting (zichtbaar voor melder)<textarea name="note" minLength={8} maxLength={1000} rows={3} required/></label></ActionForm>;}
