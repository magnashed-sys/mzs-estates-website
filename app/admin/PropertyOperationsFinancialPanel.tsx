"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import type {OpsCostSummary} from "../../lib/property-operations/financial-summary";
import s from "./FinancialCockpit.module.css";

type Data=OpsCostSummary&{
 properties:(OpsCostSummary["properties"][number]&{propertyName?:string})[]
};
const euro=(n:number)=>new Intl.NumberFormat("en-GB",{
 style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2
}).format(n/100);
const monthName=(m:string)=>new Date(m+"-01T12:00:00Z").toLocaleDateString(
 "en-GB",{month:"short",timeZone:"UTC"}
);
const categoryName=(name:string)=>({
 electricity:"Electricity",gas:"Gas",water:"Water",cleaning:"Cleaning",
 internet:"Internet",insurance:"Insurance",taxes:"Taxes & levies",
 maintenance:"Maintenance",materials:"Materials",management:"Management",other:"Other"
} as Record<string,string>)[name]??name;

/**
 * Shown only for the explicitly configured Staging Supabase project.
 * This does NOT change the existing Financial Cockpit rent/loan/cashflow model.
 */
export default function PropertyOperationsFinancialPanel({
 year,month,entity,refreshVersion
}:{year:number;month:number;entity:string;refreshVersion:number}){
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const ctrl=new AbortController();
  setLoading(true);setError("");setData(null);
  fetch("/api/admin/property-operations-costs?year="+year+"&entity="+encodeURIComponent(entity),{
   cache:"no-store",signal:ctrl.signal
  }).then(async response=>{
   if(!response.ok)throw new Error("The complete property expense register is unavailable");
   return await response.json() as Data;
  }).then(value=>{
   if(value.year!==year||value.entityId!==entity||value.completeness!=="verified-registers"||
      value.cashPaidKnown!==false||value.months.length!==12)
     throw new Error("Expense reporting scope or status invalid");
   if(!ctrl.signal.aborted)setData(value);
  }).catch(()=>{
   if(!ctrl.signal.aborted)setError("Operating expenses could not be fully verified. No partial cost totals are displayed.");
  }).finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
  return ()=>ctrl.abort();
 },[year,entity,refreshVersion]);
 const row=data?.months.find(x=>x.month===year+"-"+String(month).padStart(2,"0"));
 const topProperties=data?.properties.slice(0,8)??[];
 const topCategories=data?.categories.slice(0,8)??[];
 return <section className={s.opsSection} aria-labelledby="ops-financial-heading">
  <div className={s.panelHeading}>
   <div>
    <p className={s.eyebrow}>STAGING PREVIEW / PROPERTY OPERATIONS</p>
    <h3 id="ops-financial-heading">Approved operating costs.</h3>
   </div>
   <Link href="/admin/workspaces/estates/expenses" className={s.cardLink}>View cost register ↗</Link>
  </div>
  <p className={s.miniCopy}>Supplier invoices by <strong>invoice date</strong> and verified legal entity.
   These are approved accruals, <strong>not paid supplier cash</strong>. They are not subtracted from the existing
   forecast or recorded net cashflow. Gross amounts include source VAT, without a tax-deductibility judgement.</p>
  {loading&&<p role="status" className={s.status}>Verifying complete property cost registers…</p>}
  {error&&<p role="alert" className={s.failure}>{error}</p>}
  {data&&!loading&&<>
   <div className={s.opsCards}>
    <div><small>Approved supplier costs · {year}</small><strong>{euro(data.approved.grossCents)}</strong>
      <span>{data.approved.count} approved original invoice(s), VAT {euro(data.approved.vatCents)}</span></div>
    <div><small>Selected month</small><strong>{euro(row?.approvedGrossCents??0)}</strong>
      <span>{row?.approvedCount??0} approved supplier cost(s)</span></div>
    <div><small>Draft / submitted</small><strong>{data.pending.count}</strong>
      <span>{euro(data.pending.grossCents)} pending; excluded from approved costs</span></div>
    <div><small>Rejected / corrections</small><strong>{data.attention.count}</strong>
      <span>{euro(data.attention.grossCents)} requires review or replacement</span></div>
   </div>
   <div className={s.opsGrid}>
    <div>
     <h4>Monthly approved supplier costs</h4>
     <div className={s.opsMonthRows}>
      {data.months.map(m=><div className={s.opsMonthRow} key={m.month}>
       <span>{monthName(m.month)}</span>
       <div className={s.opsBarTrack}><span style={{width:
         (Math.max(0,m.approvedGrossCents)/Math.max(1,...data.months.map(x=>x.approvedGrossCents))*100)+"%"}}/></div>
       <strong>{euro(m.approvedGrossCents)}</strong>
      </div>)}
     </div>
    </div>
    <div>
     <h4>Costs by physical property</h4>
     {topProperties.length===0?<p className={s.miniCopy}>No approved property costs in this reporting scope.</p>:
       topProperties.map(x=><div className={s.detailRow} key={x.propertyId}>
        <span>{x.propertyName??"Unverified property"}</span><strong>{euro(x.approvedGrossCents)}</strong>
       </div>)}
     <h4 className={s.opsSecondHead}>By cost category</h4>
     {topCategories.map(x=><div className={s.detailRow} key={x.category}>
      <span>{categoryName(x.category)}</span><strong>{euro(x.approvedGrossCents)}</strong>
     </div>)}
    </div>
   </div>
   <p className={s.opsCaveat}>Financial classification: these approved purchase invoices are not evidence of payment,
    are not VAT filings and cannot be netted against booking quotes or loan principal.
    The existing Financial Cockpit values stay unchanged. Corrections requiring replacement remain excluded.</p>
  </>}
 </section>;
}
