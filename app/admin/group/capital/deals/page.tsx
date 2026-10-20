import Link from 'next/link';
import {requireDealsAdmin} from '../../../../../lib/security/capital-deals';
import DealForm from './DealForm';
import {type Deal,money,label} from './model';
import s from './deals.module.css';
export const dynamic='force-dynamic';
export default async function Deals({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const {db}=await requireDealsAdmin();const query=await searchParams;
 const {data,error,count}=await db.from('mzs_capital_deals').select('*',{count:'exact'}).order('created_at',{ascending:false}).limit(500);
 return <><nav className={s.nav}><Link href="/admin/group/capital">← Capital management</Link><Link href="/admin/capital-requests">Capital requests</Link></nav>
  <p className="mzsEyebrow">MZS CAPITAL / PRIVATE DEALS</p><h1>Loans & agreements</h1>
  <p className="mzsIntro">One private dossier for each loan. Keep the contract, planned cash flows and confirmed payments together.</p>
  <p className={s.notice}>Staging review · Full administrators only. No client access or email notifications. Source schedules do not prove payment.</p>
  {query.notice&&<p role={query.notice==='saved'?'status':'alert'} className={s.notice}>{query.notice==='saved'?'Saved successfully.':'The operation could not be confirmed. Check the values and reload before retrying.'}</p>}
  {error||count!==(data||[]).length?<p role="alert">Unable to load a complete deal list. No totals are displayed.</p>:['provided','received'].map(direction=>{
   const deals=(data as Deal[]).filter(d=>d.direction===direction);
   return <section className={s.section} key={direction}><h2>{direction==='provided'?'Loans Provided':'Loans Received'}</h2>
    <p>{direction==='provided'?'Funds lent to a borrower.':'Funding received from a lender.'} {deals.length} {deals.length===1?'dossier':'dossiers'}.</p>
    <div className={s.grid}>{deals.map(d=><Link className={s.card} href={'/admin/group/capital/deals/'+d.id} key={d.id}>
     <span className={s.badge}>{label(d.status)}</span><span className={s.badge}>{label(d.review_state)}</span><h3>{d.title}</h3>
     <div className={s.amount}>{money(d.principal)}</div><p>Original principal · {Number(d.annual_rate)}% per annum</p><p>{d.lender} → {d.borrower}</p><span>Open private dossier →</span>
    </Link>)}</div>{!deals.length&&<p className={s.empty}>No loans recorded in this category.</p>}
   </section>;
  })}
  <section className={s.section}><details><summary>Create a new loan dossier</summary><DealForm/></details></section>
 </>;
}
