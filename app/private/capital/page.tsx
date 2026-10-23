import {getTranslations} from "next-intl/server";
import {notFound,redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import s from './summary.module.css';
import {capitalClientEnvironmentAllowed} from '../../../lib/security/capital-client-environment';
import SummaryCards,{type Summary} from './SummaryCards';
export const dynamic='force-dynamic';
export async function generateMetadata() { const t = await getTranslations("AccountUI"); return {title: t("a096"), robots: {index:false, follow:false}}; }
export default async function ClientCapital(){
 if(!capitalClientEnvironmentAllowed())notFound();
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)redirect('/login');
 const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profileError||!profile?.is_active||!['client','partner'].includes(profile.role))notFound();
 const t = await getTranslations("AccountUI");
 const {data,error}=await db.rpc('mzs_my_capital_summaries');
 const items=(data||[]) as Summary[];
 return <main className={s.page}>
  <header className={s.header}><a href="/private">MZS GROUP</a><span>{t("a098")}</span></header>
  <div className={s.content}><a className={s.back} href="/private">{t("a099")}</a>
   <p className={s.eyebrow}>MZS CAPITAL</p><h1>{t("a101")}</h1>
   <p className={s.intro}>{t("a102")}</p>
   <p className={s.preview}>{process.env.VERCEL_ENV==='preview'?t("a103") + " ":''}{t("a104")}</p>
   {error?<p role="alert">{t("a105")}</p>:items.length===0?<section className={s.card}><h2>{t("a106")}</h2><p>{t("a107")}</p></section>:<SummaryCards items={items}/>}
   <p className={s.note}>{t("a108")}</p>
  </div>
 </main>;
}
