
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {requireDealsAdmin} from '../../../../../lib/security/capital-deals';
import DealForm from './DealForm';
import {type Deal,money,label} from './model';
import s from './deals.module.css';
export const dynamic='force-dynamic';
export default async function Deals({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireDealsAdmin();const query=await searchParams;
 const {data,error,count}=await db.from('mzs_capital_deals').select('*',{count:'exact'}).order('created_at',{ascending:false}).limit(500);
 return <><nav className={s.nav}><Link href="/admin/group/capital">{adminT("← Capital management")}</Link><Link href="/admin/capital-requests">{adminT("Capital requests")}</Link></nav>
  <Link href="/admin?tab=capital" className={s.nav}>{adminT("← Administration · Private Capital")}</Link>
  <p className="mzsEyebrow">{adminT("MZS CAPITAL / PRIVATE DEALS")}</p><h1>{adminT("Loans & agreements")}</h1>
  <p className="mzsIntro">{adminT("One private dossier for each loan. Keep the contract, planned cash flows and confirmed payments together.")}</p>
  <p className={s.notice}>{process.env.VERCEL_ENV === 'preview' ? adminT("Staging review · ") : ''}{adminT("Full administrators manage these dossiers. Selected clients can receive limited, read-only access through Client access inside a dossier. Source schedules do not prove payment.")}</p>
  {query.notice&&<p role={query.notice==='saved'?'status':'alert'} className={s.notice}>{query.notice==='saved'?adminT("Saved successfully."):adminT("The operation could not be confirmed. Check the values and reload before retrying.")}</p>}
  {error||count!==(data||[]).length?<p role="alert">{adminT("Unable to load a complete deal list. No totals are displayed.")}</p>:['provided','received'].map(direction=>{
   const deals=(data as Deal[]).filter(d=>d.direction===direction);
   return <section className={s.section} key={direction}><h2>{direction==='provided'?adminT("Loans Provided"):adminT("Loans Received")}</h2>
    <p>{direction==='provided'?adminT("Funds lent to a borrower."):adminT("Funding received from a lender.")} {deals.length} {deals.length===1?adminT("dossier"):adminT("dossiers")}.</p>
    <div className={s.grid}>{deals.map(d=><Link className={s.card} href={'/admin/group/capital/deals/'+d.id} key={d.id}>
     <span className={s.badge}>{adminT(label(d.status))}</span><span className={s.badge}>{adminT(label(d.review_state))}</span><h3>{d.title}</h3>
     <div className={s.amount}>{money(d.principal, adminLocale)}</div><p>{adminT("Original principal ·")} {Number(d.annual_rate)}{adminT("% per annum")}</p><p>{d.lender} → {d.borrower}</p><span>{adminT("Open private dossier →")}</span>
    </Link>)}</div>{!deals.length&&<p className={s.empty}>{adminT("No loans recorded in this category.")}</p>}
   </section>;
  })}
  <section className={s.section}><details><summary>{adminT("Create a new loan dossier")}</summary><DealForm/></details></section>
 </>;
}
