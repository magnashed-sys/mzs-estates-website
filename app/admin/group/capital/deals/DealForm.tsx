import {saveDeal} from './actions';
import type {Deal} from './model';
import s from './deals.module.css';
export default function DealForm({deal}:{deal?:Deal}) {
 return <form action={saveDeal} className={s.form}>
  <input type="hidden" name="id" value={deal?.id||''}/>
  <label>Deal name<input name="title" defaultValue={deal?.title} required minLength={2} maxLength={160}/></label>
  <label>Direction<select name="direction" defaultValue={deal?.direction||'provided'}><option value="provided">Loan provided</option><option value="received">Loan received</option></select></label>
  <label>Lender<input name="lender" defaultValue={deal?.lender} required minLength={2} maxLength={200}/></label>
  <label>Borrower<input name="borrower" defaultValue={deal?.borrower} required minLength={2} maxLength={200}/></label>
  <label>Original principal (EUR)<input name="principal" type="number" min="0.01" step="0.01" required defaultValue={deal?.principal}/></label>
  <label>Annual interest (%)<input name="annual_rate" type="number" min="0" max="100" step="0.0001" required defaultValue={deal?.annual_rate}/></label>
  <label>Agreement date<input name="agreement_date" type="date" defaultValue={deal?.agreement_date||''}/></label>
  <label>Funding date<input name="start_date" type="date" defaultValue={deal?.start_date||''}/></label>
  <label>Maturity date (if confirmed)<input name="maturity_date" type="date" defaultValue={deal?.maturity_date||''}/></label>
  <label>Deal status<select name="status" defaultValue={deal?.status||'draft'}>{['draft','in_discussion','agreed','active','completed'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
  <label>Source review<select name="review_state" defaultValue={deal?.review_state||'needs_review'}><option value="needs_review">Needs review</option><option value="reviewed">Reviewed by administrator</option></select></label>
  <label className={s.wide}>Source references<textarea name="source_reference" maxLength={2000} defaultValue={deal?.source_reference} placeholder="Supplied agreement and schedule; attach PDFs separately below."/></label>
  <label className={s.wide}>Terms, security and review notes<textarea name="notes" rows={5} maxLength={8000} defaultValue={deal?.notes}/></label>
  <p className={s.wide}>Saving terms does not regenerate the schedule or confirm any payment. Party names describe the actual contract parties; MZS Group is the management platform.</p>
  <button type="submit">{deal?'Save deal details':'Create private deal'}</button>
 </form>;
}
