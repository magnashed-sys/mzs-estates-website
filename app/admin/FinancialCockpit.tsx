'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {CockpitData,MonthlyMoney} from '../../lib/finance/financial-cockpit';
import s from './FinancialCockpit.module.css';

function madridParts(){
 const items=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const find=(type:string)=>items.find(p=>p.type===type)?.value??'';
 return {year:Number(find('year')),month:Number(find('month'))};
}
const displayEuro=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const monthLabel=(key:string)=>new Date(key+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'});
const sum=(rows:MonthlyMoney[],key:keyof MonthlyMoney)=>rows.reduce((a,r)=>a+Number(r[key]),0);
export default function FinancialCockpit({refreshVersion}:{refreshVersion:number}){
 const [current]=useState(madridParts);
 const [year,setYear]=useState(current.year);
 const [month,setMonth]=useState(current.month);
 const [data,setData]=useState<CockpitData|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const ctrl=new AbortController();
  setLoading(true);setError('');setData(null);
  fetch('/api/admin/financial-cockpit?year='+year,{cache:'no-store',signal:ctrl.signal})
   .then(async r=>{if(!r.ok)throw new Error('The complete financial overview could not be loaded.');return r.json() as Promise<CockpitData>;})
   .then(setData).catch(()=>{if(!ctrl.signal.aborted)setError('Financial data is currently unavailable. Totals are hidden to avoid an incomplete report.');})
   .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
  return ()=>ctrl.abort();
 },[year,retry,refreshVersion]);
 const selected=data?.rows.find(r=>r.month===year+'-'+String(month).padStart(2,'0'));
 const rows=data?.rows||[];
 const loanAvailable=data?.loansAvailable===true;
 const chartMax=Math.max(1,...rows.flatMap(r=>[r.rentForecast,loanAvailable?r.interestIn:0,loanAvailable?r.interestOut:0]));
 const loanNotice=data?.quality.loansNeedingReview||0;
 const cards=[
  {title:'Long-term rental income',line:'Active contract schedules · expected gross billing',value:selected?.rentForecast??0,annual:sum(rows,'rentForecast'),path:'/admin/group/estates/contracts?view=contracts',available:true,accent:'rent'},
  {title:'Interest from loans provided',line:'Scheduled interest · not principal repayment',value:selected?.interestIn??0,annual:sum(rows,'interestIn'),path:'/admin/group/capital/deals',available:loanAvailable,accent:'credit'},
  {title:'Interest on loans received',line:'Scheduled interest expense · not loan repayment',value:selected?.interestOut??0,annual:sum(rows,'interestOut'),path:'/admin/group/capital/deals',available:loanAvailable,accent:'expense'}
 ];
 return <section className={s.cockpit} aria-labelledby="financial-cockpit-heading">
  <div className={s.top}>
   <div><p className={s.eyebrow}>MZS GROUP / FINANCIAL OVERVIEW</p><h2 id="financial-cockpit-heading">Financial Cockpit</h2>
    <p className={s.lead}>Contractual forecasts, scheduled loan interest and confirmed holiday bookings — one read-only overview.</p></div>
   <div className={s.controls}>
    <label>Year<select value={year} onChange={e=>setYear(Number(e.target.value))}>
     {[current.year-1,current.year,current.year+1].map(y=><option key={y} value={y}>{y}</option>)}
    </select></label>
    <label>Month<select value={month} onChange={e=>setMonth(Number(e.target.value))}>
     {Array.from({length:12},(_,i)=><option key={i} value={i+1}>{monthLabel(year+'-'+String(i+1).padStart(2,'0'))}</option>)}
    </select></label>
    <button type="button" onClick={()=>setRetry(r=>r+1)} disabled={loading} className={s.refresh}>Refresh ↗</button>
   </div>
  </div>
  {loading&&<div className={s.status} role="status">Loading verified financial registers…</div>}
  {error&&<div className={s.failure} role="alert">{error}</div>}
  {data&&!loading&&<>
   <div className={s.metrics}>
    {cards.map(card=><div key={card.title} className={s.metric}>
     <div className={s.metricHead}><span className={s.kicker}>{card.title}</span><span className={s.dot} data-kind={card.accent}/></div>
     <strong className={s.metricValue}>{card.available?displayEuro(card.value):'—'}</strong>
     <div className={s.metricDivider}/>
     <div className={s.metricBottom}><span>Selected month</span><span>Calendar year <strong>{card.available?displayEuro(card.annual):'—'}</strong></span></div>
     <p className={s.metricLine}>{card.line}</p>
     {card.available?<Link className={s.cardLink} href={card.path}>View source records ↗</Link>:<p className={s.unavailable}>Capital register is not enabled for this environment.</p>}
    </div>)}
    <div className={s.metric}>
     <div className={s.metricHead}><span className={s.kicker}>Confirmed holiday bookings</span><span className={s.dot} data-kind="bookings"/></div>
     <strong className={s.metricValue}>{displayEuro(data.bookings.total)}</strong>
     <div className={s.metricDivider}/>
     <div className={s.metricBottom}><span>Next 3 months</span><span>{data.bookings.confirmed} confirmed stays</span></div>
     <p className={s.metricLine}>Quoted stay value, allocated by nights. No test or cancelled bookings.</p>
     <Link className={s.cardLink} href="/admin?tab=bookings">View bookings ↗</Link>
    </div>
   </div>
   <div className={s.summaryGrid}>
    <section className={s.chartPanel} aria-label="Monthly cashflow forecasts">
     <div className={s.panelHeading}><div><p className={s.eyebrow}>TWELVE MONTH OVERVIEW</p><h3>Contractual outlook.</h3></div><span className={s.year}>{year}</span></div>
     <div className={s.legend}><span><i className={s.rent}/>Contract rent</span><span><i className={s.credit}/>Interest income</span><span><i className={s.expense}/>Interest expense</span></div>
     <div className={s.chart} role="img" aria-label="Monthly contract rents and loan interest. Values and details shown below each month.">
      {rows.map(row=><div className={s.chartRow} key={row.month}>
       <span className={s.chartMonth}>{monthLabel(row.month)}</span>
       <div className={s.bars}>
        <div className={s.barRent} style={{width:(row.rentForecast/chartMax*100)+'%'}} title={'Contract rent '+displayEuro(row.rentForecast)}/>
        <div className={s.barCredit} style={{width:(row.interestIn/chartMax*100)+'%'}} title={'Scheduled interest in '+displayEuro(row.interestIn)}/>
        <div className={s.barExpense} style={{width:(row.interestOut/chartMax*100)+'%'}} title={'Scheduled interest out '+displayEuro(row.interestOut)}/>
       </div>
       <span className={s.chartAmount}>{displayEuro(row.rentForecast)}</span>
      </div>)}
     </div>
     <p className={s.note}>Bars show projected rental billing and scheduled interest — not confirmed bank receipts. Rental forecast includes any contract VAT. Holiday bookings are shown separately to avoid possible double counting.</p>
    </section>
    <div className={s.sidePanels}>
     <section className={s.detailPanel}>
      <p className={s.eyebrow}>NEXT THREE MONTHS</p><h3>Confirmed stays.</h3>
      <p className={s.miniCopy}>Expected booking value from {data.bookings.from} to {data.bookings.to} (end-exclusive).</p>
      {data.bookings.months.map(b=><div key={b.month} className={s.detailRow}><span>{monthLabel(b.month)} {b.month.slice(0,4)}</span><strong>{displayEuro(b.total)}</strong></div>)}
      {data.bookings.unpriced>0&&<p className={s.warning}>{data.bookings.unpriced} confirmed booking(s) have no recorded quote; their amounts are excluded.</p>}
     </section>
     <section className={s.detailPanel}>
      <p className={s.eyebrow}>RECORDED CASH MOVEMENTS / {year}</p><h3>Confirmed entries.</h3>
      <div className={s.detailRow}><span>Rent receipts</span><strong>{displayEuro(sum(rows,'rentReceived'))}</strong></div>
      <div className={s.detailRow}><span>Interest received</span><strong>{loanAvailable?displayEuro(sum(rows,'interestReceived')):'—'}</strong></div>
      <div className={s.detailRow}><span>Interest paid</span><strong>{loanAvailable?displayEuro(sum(rows,'interestPaid')):'—'}</strong></div>
      <p className={s.miniCopy}>Only payment entries recorded in MZS Group, excluding reversed or voided entries. This does not prove complete bank reconciliation.</p>
     </section>
     <section className={s.detailPanel}>
      <p className={s.eyebrow}>DATA CONFIDENCE</p><h3>Register coverage.</h3>
      <div className={s.detailRow}><span>Active lease contracts</span><strong>{data.quality.contracts}</strong></div>
      <div className={s.detailRow}><span>Active loan dossiers</span><strong>{loanAvailable?data.quality.loansActive:'—'}</strong></div>
      {loanNotice>0&&<p className={s.warning}>{loanNotice} active loan dossier(s) still need source review; scheduled interest is provisional.</p>}
      <p className={s.miniCopy}>Future entity filters and reconciled cashflow will be introduced in the next phase. No loan principals or deposits are counted as interest.</p>
     </section>
    </div>
   </div>
   <p className={s.footerNote}>Financial Cockpit · Information derived from existing protected MZS registers · Forecasts are not bank balances or audited financial statements.</p>
  </>}
 </section>;
}
