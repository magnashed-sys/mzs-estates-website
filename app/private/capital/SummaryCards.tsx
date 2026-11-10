"use client";
import {useTranslations, useLocale} from "next-intl";
import s from './summary.module.css';
import type {ClientCapitalSummary} from '../../../lib/capital/client-summary';
export type Summary=ClientCapitalSummary;
export default function SummaryCards({items}:{items:Summary[]}) {
 const t = useTranslations("CapitalUI");
 const locale = useLocale();
const money=(n:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(n);
const day=(d:string|null)=>d?new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')):t("not_confirmed");
 return <>{items.map(d=><article className={s.card} key={d.id}>
    <p className={s.eyebrow}>{d.party_role==='lender'?t("lender"):t("borrower")}</p><h2>{d.label}</h2>
    <dl className={s.facts}>
     <div><dt>{t("loan")}</dt><dd>{money(d.principal)}</dd></div>
     <div><dt>{t("rate_label")}</dt><dd>{d.annual_rate == null ? t("not_specified") : `${new Intl.NumberFormat(locale,{maximumFractionDigits:4}).format(d.annual_rate)}%`}</dd></div>
     <div><dt>{t("start")}</dt><dd>{day(d.start_date)}</dd></div><div><dt>{t("end")}</dt><dd>{day(d.end_date)}</dd></div>
    </dl>
    <dl className={s.overview}>
     <div><dt>{d.party_role==='lender'?t('total_received'):t('total_paid')}</dt><dd>{money(d.party_role==='lender'?d.total_interest_received:d.total_interest_paid)}</dd></div>
     {d.interest.terms.length>0&&<><div><dt>{t('remaining_scheduled')}</dt><dd>{money(d.interest.remaining)}</dd></div>
     <div className={s.next}><dt>{t('next_open')}</dt><dd>{d.interest.next?money(d.interest.next.remaining):t('schedule_settled')}</dd>
      {d.interest.next&&<><small>{day(d.interest.next.due_date)}</small>{d.interest.next.due_date<d.interest.as_of&&<small className={s.attention}>{t('past_due_unconfirmed')}</small>}</>}
     </div></>}
    </dl>
    <h3>{t('schedule_title')}</h3>
    {d.interest.terms.length?<ol className={s.terms}>{d.interest.terms.map((term,i)=><li key={`${term.due_date}-${i}`}>
     <div className={s.termHeader}><time dateTime={term.due_date}>{day(term.due_date)}</time>{term.remaining===0&&<span className={s.settled}>{t('settled')}</span>}</div>
     <dl className={s.termAmounts}><div><dt>{t('planned_amount')}</dt><dd>{money(term.scheduled)}</dd></div><div><dt>{t('credit_applied')}</dt><dd>{money(term.credit)}</dd></div><div><dt>{t('remaining_amount')}</dt><dd>{money(term.remaining)}</dd></div></dl>
    </li>)}</ol>:<p className={s.empty}>{t('schedule_empty')}</p>}
    <p className={s.note}>{t('schedule_note')}</p>
    {d.interest.credits.length>0&&<section className={s.credits} aria-label={t('credits_title')}><h3>{t('credits_title')}</h3><ul>
     {d.interest.credits.map((c,i)=><li key={i}><strong>{money(c.amount)}</strong><span>{t('credit_transfer',{from:day(c.from),to:day(c.to)})}</span></li>)}
    </ul><p className={s.note}>{t('credit_explanation')}</p></section>}
    {d.interest.unallocated_credit>0&&<p className={s.note}>{t('unallocated_credit')}: <strong>{money(d.interest.unallocated_credit)}</strong></p>}
    <details className={s.history}><summary>{d.party_role==='lender'?t('interest_received'):t('interest_paid')} <span>({d.interest_payments.length})</span></summary>
    {d.interest_payments.length?<div className={s.tableWrap}><table><caption>{t("confirmed_payments")}</caption><thead><tr><th scope="col">{t("payment_date")}</th><th scope="col">{t("amount")}</th></tr></thead><tbody>{d.interest_payments.map((p,i)=><tr key={i}><td>{day(p.date)}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></div>:<p className={s.empty}>{t("no_payments")}</p>}
    <p className={s.note}>{t("confirmed_note")}</p>
    </details>
   </article>)}</>;
}
