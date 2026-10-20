import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import s from './summary.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Your Capital | MZS Group',robots:{index:false,follow:false}};
type Summary={id:string;label:string;party_role:'lender'|'borrower';principal:number;currency:string;start_date:string|null;end_date:string|null;total_interest_received:number;total_interest_paid:number;interest_payments:{date:string;amount:number}[]};
const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(n);
const day=(d:string|null)=>d?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')):'Not confirmed';
export default async function ClientCapital(){
 if(process.env.VERCEL_ENV!=='preview'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://senonkpxdtlhyhrubicg.supabase.co')notFound();
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)redirect('/login');
 const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profileError||!profile?.is_active||!['client','partner'].includes(profile.role))notFound();
 const {data,error}=await db.rpc('mzs_my_capital_summaries');
 const items=(data||[]) as Summary[];
 return <main className={s.page}>
  <header className={s.header}><Link href="/private">MZS GROUP</Link><span>PRIVATE CLIENT ACCESS</span></header>
  <div className={s.content}><Link className={s.back} href="/private">← Your private dashboard</Link>
   <p className={s.eyebrow}>MZS CAPITAL</p><h1>Your private capital.</h1>
   <p className={s.intro}>Your loan details and confirmed interest payments, in one private overview.</p>
   <p className={s.preview}>Staging preview · Figures are shown from your perspective as lender or borrower.</p>
   {error?<p role="alert">Your capital overview could not be loaded. Please try again later.</p>:items.length===0?<section className={s.card}><h2>No dossiers shared yet.</h2><p>Your relationship manager will let you know when a dossier is available.</p></section>:items.map(d=><article className={s.card} key={d.id}>
    <p className={s.eyebrow}>{d.party_role==='lender'?'YOU ARE THE LENDER':'YOU ARE THE BORROWER'}</p><h2>{d.label}</h2>
    <dl className={s.facts}>
     <div><dt>Loan amount</dt><dd>{money(d.principal)}</dd></div>
     <div><dt>Start date</dt><dd>{day(d.start_date)}</dd></div><div><dt>End date</dt><dd>{day(d.end_date)}</dd></div>
     <div><dt>Total interest received</dt><dd>{money(d.total_interest_received)}</dd></div>
     <div><dt>Total interest paid</dt><dd>{money(d.total_interest_paid)}</dd></div>
    </dl>
    <h3>{d.party_role==='lender'?'Interest received':'Interest paid'}</h3>
    {d.interest_payments.length?<div className={s.tableWrap}><table><caption>Confirmed interest payments</caption><thead><tr><th scope="col">Payment date</th><th scope="col">Amount</th></tr></thead><tbody>{d.interest_payments.map((p,i)=><tr key={i}><td>{day(p.date)}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></div>:<p className={s.empty}>No interest payments have been confirmed in this dossier yet.</p>}
    <p className={s.note}>Only confirmed interest is included. Scheduled interest and principal repayments are excluded. A missing confirmation does not mean a payment is overdue.</p>
   </article>)}
   <p className={s.note}>Questions about a date or payment? Please contact your MZS relationship manager.</p>
  </div>
 </main>;
}
