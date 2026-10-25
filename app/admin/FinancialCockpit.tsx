'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {MonthlyMoney} from '../../lib/finance/financial-cockpit';
import type {FinancialPhase2,FinancialEntity} from '../../lib/finance/financial-report';
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
 const [data,setData]=useState<FinancialPhase2|null>(null);
 const [entityOptions,setEntityOptions]=useState<FinancialEntity[]>([]);
 const [entity,setEntity]=useState('all');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const ctrl=new AbortController();
  setLoading(true);setError('');setData(null);
  fetch('/api/admin/financial-cockpit?year='+year+'&entity='+encodeURIComponent(entity),{cache:'no-store',signal:ctrl.signal})
   .then(async r=>{if(!r.ok)throw new Error('The complete financial overview could not be loaded.');return r.json() as Promise<FinancialPhase2>;})
   .then(next=>{setEntityOptions(next.entities);setData(next);}).catch(()=>{if(!ctrl.signal.aborted)setError('Financial data is currently unavailable. Totals are hidden to avoid an incomplete report.');})
   .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
  return ()=>ctrl.abort();
 },[year,entity,retry,refreshVersion]);
 const selected=data?.rows.find(r=>r.month===year+'-'+String(month).padStart(2,'0'));
 const rows=data?.rows||[];
 const loanAvailable=data?.loansAvailable===true;
 const loanAttributed=loanAvailable&&(entity==='all'||entity==='unassigned');
 const entityLabel=entity==='all'?'MZS Group consolidated':data?.entities.find(e=>e.id===entity)?.name||'Selected entity';
 const chartMax=Math.max(1,...rows.flatMap(r=>[r.rentForecast,loanAttributed?r.interestIn:0,loanAttributed?r.interestOut:0]));
 const loanNotice=data?.quality.loansNeedingReview||0;
 const exportCsv=()=>{
  if(!data||loading)return;
  const headers=['Month','Expected rent EUR','Recorded rent receipts EUR','Scheduled interest income EUR',
   'Scheduled interest expense EUR','Recorded interest received EUR','Recorded interest paid EUR',
   'Net forecast EUR','Net recorded EUR'];
  const lines=[headers.join(';'),...data.rows.map(r=>[
   r.month,r.rentForecast,r.rentReceived,r.interestIn,r.interestOut,r.interestReceived,r.interestPaid,
   Math.round((r.rentForecast+r.interestIn-r.interestOut)*100)/100,
   Math.round((r.rentReceived+r.interestReceived-r.interestPaid)*100)/100
  ].join(';'))];
  const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='MZS-financial-report-'+year+'-'+(entity==='all'?'group':entity)+'.csv';
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 };
 const cards=[
  {title:'Long-term rental income',line:'Active contract schedules · expected gross billing',value:selected?.rentForecast??0,annual:sum(rows,'rentForecast'),path:'/admin/group/estates/contracts?view=contracts',available:true,accent:'rent'},
  {title:'Interest from loans provided',line:'Scheduled interest · not principal repayment',value:selected?.interestIn??0,annual:sum(rows,'interestIn'),path:'/admin/group/capital/deals',available:loanAttributed,accent:'credit'},
  {title:'Interest on loans received',line:'Scheduled interest expense · not loan repayment',value:selected?.interestOut??0,annual:sum(rows,'interestOut'),path:'/admin/group/capital/deals',available:loanAttributed,accent:'expense'}
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
    <label>Reporting entity<select aria-label="Reporting entity" value={entity} onChange={e=>setEntity(e.target.value)}>
      <option value="all">MZS Group consolidated</option>
      {entityOptions.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
     </select></label>
    <button type="button" onClick={()=>setRetry(r=>r+1)} disabled={loading} className={s.refresh}>Refresh ↗</button>
    <button type="button" onClick={exportCsv} disabled={loading||!data} className={s.refresh}>Export CSV ↓</button>
   </div>
  </div>
  {loading&&<div className={s.status} role="status">Loading verified financial registers…</div>}
  {error&&<div className={s.failure} role="alert">{error}</div>}
  {data&&!loading&&<>
   <div className={s.scopeNote}>Reporting scope: <strong>{entityLabel}</strong>. Only explicitly registered invoice issuers are attributed. Unlinked records stay visible as Unassigned.</div>
   <div className={s.metrics}>
    {cards.map(card=><div key={card.title} className={s.metric}>
     <div className={s.metricHead}><span className={s.kicker}>{card.title}</span><span className={s.dot} data-kind={card.accent}/></div>
     <strong className={s.metricValue}>{card.available?displayEuro(card.value):'—'}</strong>
     <div className={s.metricDivider}/>
     <div className={s.metricBottom}><span>Selected month</span><span>Calendar year <strong>{card.available?displayEuro(card.annual):'—'}</strong></span></div>
     <p className={s.metricLine}>{card.line}</p>
     {card.available?<Link className={s.cardLink} href={card.path}>View source records ↗</Link>:<p className={s.unavailable}>{loanAvailable?'No validated entity association for loan dossiers yet.':'Capital register is not enabled for this environment.'}</p>}
    </div>)}
    <div className={s.metric}>
     <div className={s.metricHead}><span className={s.kicker}>Confirmed holiday bookings</span><span className={s.dot} data-kind="bookings"/></div>
     <strong className={s.metricValue}>{entity==='all'||entity==='unassigned'?displayEuro(data.bookings.total):'—'}</strong>
     <div className={s.metricDivider}/>
     <div className={s.metricBottom}><span>Next 3 months</span><span>{data.bookings.confirmed} confirmed stays</span></div>
     <p className={s.metricLine}>{entity==='all'||entity==='unassigned'?'Quoted stay value, allocated by nights. No test or cancelled bookings.':'Holiday bookings do not yet have verified legal-entity assignments.'}</p>
     <Link className={s.cardLink} href="/admin?tab=bookings">View bookings ↗</Link>
    </div>
   </div>
   <section className={s.netStrip} aria-label="Forecast and recorded cash movements">
     <div><span>Annual net cashflow forecast</span><strong>{displayEuro(data.report.expectedNet)}</strong><small>Contract rent + interest income − interest expense. Excludes bookings, principal and other operating costs.</small></div>
     <div><span>Recorded net cash movements</span><strong>{displayEuro(data.report.recordedNet)}</strong><small>Only MZS payment entries. Not a fully reconciled bank balance.</small></div>
     <div><span>Outstanding issued invoices</span><strong>{displayEuro(data.report.outstandingRent)}</strong><small>{displayEuro(data.report.overdueRent)} past due; check bank reconciliation before collection.</small></div>
    </section>
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
      <div className={s.detailRow}><span>Past-due loan interest receivable</span><strong>{displayEuro(data.report.overdueLoanReceivables)}</strong></div>
      <div className={s.detailRow}><span>Past-due loan interest payable</span><strong>{displayEuro(data.report.overdueLoanPayables)}</strong></div>
     </section>
     <section className={s.detailPanel}>
      <p className={s.eyebrow}>DATA CONFIDENCE</p><h3>Register coverage.</h3>
      <div className={s.detailRow}><span>Active lease contracts</span><strong>{data.quality.contracts}</strong></div>
      <div className={s.detailRow}><span>Active loan dossiers</span><strong>{loanAvailable?data.quality.loansActive:'—'}</strong></div>
      {loanNotice>0&&<p className={s.warning}>{loanNotice} active loan dossier(s) still need source review; scheduled interest is provisional.</p>}
      <div className={s.detailRow}><span>Unassigned active lease contracts</span><strong>{data.report.unassignedContracts}</strong></div>
      {(data.report.loanAttributionPending>0||data.report.bookingAttributionPending>0)&&<p className={s.warning}>Source attribution is still needed for {data.report.loanAttributionPending} active loan dossier(s) and {data.report.bookingAttributionPending} confirmed booking(s). They remain Unassigned, not assumed to belong to a company.</p>}
      <p className={s.miniCopy}>Only explicit issuer IDs link contract and invoice totals to legal entities. Principal, deposits and booking receipts are never treated as interest.</p>
     </section>
    </div>
   </div>
   <section className={s.reportTable} aria-label="Monthly financial reporting">
    <div className={s.panelHeading}><div><p className={s.eyebrow}>FINANCIAL REPORT / {year}</p><h3>Forecast versus recorded.</h3></div><button className={s.refresh} type="button" onClick={exportCsv}>Export report CSV ↓</button></div>
    <div className={s.tableScroll}><table>
     <thead><tr><th>Month</th><th>Rent forecast</th><th>Interest in</th><th>Interest out</th><th>Net forecast</th><th>Net recorded</th></tr></thead>
     <tbody>{rows.map(r=><tr key={r.month}><th scope="row">{monthLabel(r.month)} {year}</th>
      <td>{displayEuro(r.rentForecast)}</td><td>{loanAttributed?displayEuro(r.interestIn):'—'}</td>
      <td>{loanAttributed?displayEuro(r.interestOut):'—'}</td>
      <td>{displayEuro(r.rentForecast+r.interestIn-r.interestOut)}</td>
      <td>{displayEuro(r.rentReceived+r.interestReceived-r.interestPaid)}</td>
     </tr>)}</tbody>
    </table></div>
    <p className={s.note}>Interest not linked to a legal entity is excluded when an individual issuer is selected. Exports follow the selected reporting scope.</p>
   </section>
   <p className={s.footerNote}>Financial Cockpit · Scope: {entityLabel} · Not a bank statement, operating profit calculation or audited financial report.</p>
  </>}
 </section>;
}
