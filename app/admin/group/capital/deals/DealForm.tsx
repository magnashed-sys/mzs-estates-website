
import {useAdminI18n} from '../../../../../lib/admin/i18n';
import {saveDeal} from './actions';
import type {Deal} from './model';
import s from './deals.module.css';
export default function DealForm({deal,entities=[]}:{deal?:Deal;entities?:{id:string;name:string;kind:string}[]}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 return <form action={saveDeal} className={s.form}>
  <input type="hidden" name="id" value={deal?.id||''}/>
  <label>{adminT("Deal name")}<input name="title" defaultValue={deal?.title} required minLength={2} maxLength={160}/></label>
  <label>{adminT("Financial reporting entity")}<select name="entity_id" defaultValue={deal?.entity_id||''}><option value="">{adminT("Unassigned (not yet linked)")}</option>{entities.map(e=><option key={e.id} value={e.id}>{e.name} ({e.kind==='person'?adminT("private individual"):adminT("company")})</option>)}</select></label>
  <label>{adminT("Direction")}<select name="direction" defaultValue={deal?.direction||'provided'}><option value="provided">{adminT("Loan provided")}</option><option value="received">{adminT("Loan received")}</option></select></label>
  <label>{adminT("Lender")}<input name="lender" defaultValue={deal?.lender} required minLength={2} maxLength={200}/></label>
  <label>{adminT("Borrower")}<input name="borrower" defaultValue={deal?.borrower} required minLength={2} maxLength={200}/></label>
  <label>{adminT("Original principal (EUR)")}<input name="principal" type="number" min="0.01" step="0.01" required defaultValue={deal?.principal}/></label>
  <label>{adminT("Annual interest (%)")}<input name="annual_rate" type="number" min="0" max="100" step="0.0001" required defaultValue={deal?.annual_rate}/></label>
  <label>{adminT("Agreement date")}<input name="agreement_date" type="date" defaultValue={deal?.agreement_date||''}/></label>
  <label>{adminT("Funding date")}<input name="start_date" type="date" defaultValue={deal?.start_date||''}/></label>
  <label>{adminT("Maturity date (if confirmed)")}<input name="maturity_date" type="date" defaultValue={deal?.maturity_date||''}/></label>
  <label>{adminT("Deal status")}<select name="status" defaultValue={deal?.status||'draft'}>{['draft','in_discussion','agreed','active','completed'].map(x=><option key={x} value={x}>{adminT(x.replaceAll('_',' '))}</option>)}</select></label>
  <label>{adminT("Source review")}<select name="review_state" defaultValue={deal?.review_state||'needs_review'}><option value="needs_review">{adminT("Needs review")}</option><option value="reviewed">{adminT("Reviewed by administrator")}</option></select></label>
  <label className={s.wide}>{adminT("Source references")}<textarea name="source_reference" maxLength={2000} defaultValue={deal?.source_reference} placeholder={adminT("Supplied agreement and schedule; attach PDFs separately below.")}/></label>
  <label className={s.wide}>{adminT("Terms, security and review notes")}<textarea name="notes" rows={5} maxLength={8000} defaultValue={deal?.notes}/></label>
  <p className={s.wide}>{adminT("Saving terms does not regenerate the schedule or confirm any payment. Party names describe the actual contract parties; MZS Group is the management platform.")}</p>
  <button type="submit">{deal?adminT("Save deal details"):adminT("Create private deal")}</button>
 </form>;
}
