import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import s from './summary.module.css';
import {capitalClientEnvironmentAllowed} from '../../../lib/security/capital-client-environment';
import SummaryCards,{type Summary} from './SummaryCards';
export const dynamic='force-dynamic';
export const metadata={title:'Your Capital | MZS Group',robots:{index:false,follow:false}};
export default async function ClientCapital(){
 if(!capitalClientEnvironmentAllowed())notFound();
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
   <p className={s.preview}>{process.env.VERCEL_ENV==='preview'?'Staging preview · ':''}Figures are shown from your perspective as lender or borrower.</p>
   {error?<p role="alert">Your capital overview could not be loaded. Please try again later.</p>:items.length===0?<section className={s.card}><h2>No dossiers shared yet.</h2><p>Your relationship manager will let you know when a dossier is available.</p></section>:<SummaryCards items={items}/>}
   <p className={s.note}>Questions about a date or payment? Please contact your MZS relationship manager.</p>
  </div>
 </main>;
}
