import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {isLocale} from '../../../i18n/public-routing';
import {buildClientCapitalSummaries} from '../../../lib/capital/client-summary';
import SummaryCards from '../../private/capital/SummaryCards';
import s from '../../private/capital/summary.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Capital layout verification',robots:{index:false,follow:false}};

/** Isolated visual fixture. No database, accounts, grants or real financial data.
 * Production always returns 404, including on production deployment hostnames. */
export default async function CapitalReview({searchParams}:{searchParams:Promise<{locale?:string;embedded?:string}>}){
 if(process.env.VERCEL_ENV!=='preview'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://senonkpxdtlhyhrubicg.supabase.co')notFound();
 const query=await searchParams,locale=isLocale(query.locale)?query.locale:'nl';
 if(query.embedded!=='1')return <main style={{padding:24,background:'#20201d',color:'#eee'}}><h1>Capital · synthetic layout verification</h1><p>No real client data. Preview only.</p><div style={{display:'flex',gap:24,alignItems:'start'}}>
  <iframe title="Mobile Capital overview" src={`?locale=${locale}&embedded=1`} width="390" height="1600" style={{flexShrink:0,border:0}}/>
  <iframe title="Desktop Capital overview" src={`?locale=${locale}&embedded=1`} width="1100" height="1300" style={{flexShrink:0,border:0}}/>
 </div></main>;
 const messages=(await import(`../../../messages/${locale}.json`)).default;
 const items=buildClientCapitalSummaries([{summary_version:2,id:'synthetic',label:'MZS · Demonstration',party_role:'lender',principal:100000,currency:'EUR',annual_rate:6,start_date:'2026-01-15',end_date:'2027-01-15',total_interest_received:4140,total_interest_paid:0,
  interest_schedule:[{id:'earlier',due_date:'2026-09-15',amount:2000},{id:'source',due_date:'2026-10-15',amount:2000},{id:'next',due_date:'2026-11-15',amount:2000}],
  interest_payments:[{instalment_id:'earlier',date:'2026-09-15',amount:1990},{instalment_id:'source',date:'2026-10-15',amount:2150}]
 }],'2026-11-09');
 return <NextIntlClientProvider locale={locale} timeZone="Europe/Madrid" messages={{CapitalUI:messages.CapitalUI}}><main className={s.page} dir={locale==='ar'?'rtl':'ltr'}><div className={s.content}><p className={s.eyebrow}>MZS CAPITAL · DEMONSTRATION</p><SummaryCards items={items}/></div></main></NextIntlClientProvider>;
}
