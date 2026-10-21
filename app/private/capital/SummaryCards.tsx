import s from './summary.module.css';
export type Summary={id:string;label:string;party_role:'lender'|'borrower';principal:number;currency:string;annual_rate:number|null;start_date:string|null;end_date:string|null;total_interest_received:number;total_interest_paid:number;interest_payments:{date:string;amount:number}[]};
const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(n);
const day=(d:string|null)=>d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')):'Not confirmed';
export default function SummaryCards({items}:{items:Summary[]}) {
 return <>{items.map(d=><article className={s.card} key={d.id}>
    <p className={s.eyebrow}>{d.party_role==='lender'?'YOU ARE THE LENDER':'YOU ARE THE BORROWER'}</p><h2>{d.label}</h2>
    <dl className={s.facts}>
     <div><dt>Loan amount</dt><dd>{money(d.principal)}</dd></div>
     <div><dt>Annual interest rate</dt><dd>{d.annual_rate == null ? 'Not specified' : `${new Intl.NumberFormat('en-GB',{maximumFractionDigits:4}).format(d.annual_rate)}%`}</dd></div>
     <div><dt>Start date</dt><dd>{day(d.start_date)}</dd></div><div><dt>End date</dt><dd>{day(d.end_date)}</dd></div>
     <div><dt>{d.party_role==='lender'?'Total interest received':'Total interest paid'}</dt><dd>{money(d.party_role==='lender'?d.total_interest_received:d.total_interest_paid)}</dd></div>
    </dl>
    <h3>{d.party_role==='lender'?'Interest received':'Interest paid'}</h3>
    {d.interest_payments.length?<div className={s.tableWrap}><table><caption>Confirmed interest payments</caption><thead><tr><th scope="col">Payment date</th><th scope="col">Amount</th></tr></thead><tbody>{d.interest_payments.map((p,i)=><tr key={i}><td>{day(p.date)}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></div>:<p className={s.empty}>No interest payments have been confirmed in this dossier yet.</p>}
    <p className={s.note}>Only confirmed interest is included. Scheduled interest and principal repayments are excluded. A missing confirmation does not mean a payment is overdue.</p>
   </article>)}</>;
}
