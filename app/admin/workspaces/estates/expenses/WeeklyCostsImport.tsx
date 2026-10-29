"use client";
import {useAdminI18n} from '../../../../../lib/admin/i18n';


import {useMemo,useRef,useState} from "react";
import {parseWeeklyCostsCsv,summarizeWeeklyCosts,
  weeklyCostsTemplate, type ImportedWeeklyCost} from "../../../../../lib/property-operations/weekly-import";
import styles from "./expenses.module.css";

const euro = (value:number, adminLocale = 'en-GB') => new Intl.NumberFormat(adminLocale, {
  style:"currency",currency:"EUR"
}).format(value/100);

export default function WeeklyCostsImport(){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const readVersion=useRef(0);
  const [page,setPage]=useState(1);
  const [inputVersion,setInputVersion]=useState(0);
  const [rows,setRows]=useState<ImportedWeeklyCost[]>([]);
  const [error,setError]=useState("");
  const [sourceName,setSourceName]=useState("");
  const [filter,setFilter]=useState("alle");
  const [rechargeFilter,setRechargeFilter]=useState("alle");

  const summary=useMemo(()=>rows.length?summarizeWeeklyCosts(rows):null,[rows]);
  const filtered=useMemo(()=>rows.filter(r=>
    (filter==="alle"||r.location===filter) &&
    (rechargeFilter==="alle"||r.recharge===rechargeFilter)
  ),[rows,filter,rechargeFilter]);
  const pages=Math.max(1,Math.ceil(filtered.length/60));
  const shown=filtered.slice((page-1)*60,page*60);
  function clear(){readVersion.current++;setRows([]);setError("");setSourceName("");setFilter("alle");setRechargeFilter("alle");setPage(1);setInputVersion(v=>v+1);}
  function template(){
    const url=URL.createObjectURL(new Blob([weeklyCostsTemplate],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="mzs-weekly-expenses-example.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function readFile(file:File|undefined){
    const version=++readVersion.current;
    setPage(1);setRows([]);setError("");setFilter("alle");setRechargeFilter("alle");setSourceName("");
    if(!file)return;
    if(file.size>1500000 || !/\.csv$/i.test(file.name)){
      setError("Select a CSV file of up to 1.5 MB.");
      return;
    }
    try {
      const text=await file.text();
      if(version!==readVersion.current)return;
      const loaded=parseWeeklyCostsCsv(text);
      setRows(loaded);setSourceName(file.name);
    }catch(e){if(version!==readVersion.current)return;setError(e instanceof Error?e.message:"CSV could not be validated.");}
  }

  return <section className={styles.panel} aria-labelledby="weekly-costs-import" style={{marginTop:22}}>
    <p className={styles.kicker}>{adminT("04 / WEEKLY EXPENSE REVIEW")}</p>
    <h2 id="weekly-costs-import">{adminT("Review weekly statements")}</h2>
    <p className={styles.hint}>{adminT("Load a previously prepared weekly expense CSV from your device. The file is processed only in this browser: it is not uploaded, stored in the database or shared with GitHub or other services. Close this page to clear the preview.")}</p>
    <div className={styles.fields} style={{marginTop:18}}>
      <label>{adminT("Weekly expense file (.csv)")}<input key={inputVersion} type="file" accept=".csv,text/csv" onChange={e=>{void readFile(e.currentTarget.files?.[0]);}}/>
      </label>
    </div>
    <div className={styles.registerActions}><button type="button" className={styles.saveButton} onClick={template}>{adminT("Download CSV example")}</button><button type="button" className={styles.saveButton} onClick={clear}>{adminT("Clear loaded data")}</button></div>
    <p className={styles.hint}>{adminT("The example contains only synthetic data and shows the expected columns. The summary covers the entire file; filters apply to detail rows.")}</p>
    {error&&<p role="alert" className={styles.error}>{adminT(error)}  {adminT("The import was rejected in full; no partial amounts were loaded.")}</p>}
    {summary&&<>
      <p className={styles.hint}>{adminT("Loaded:")} {sourceName}. <strong>{adminT("Validation preview only; no financial posting.")}</strong></p>
      <div className={styles.importCards}>
        <div><small>{adminT("Source rows")}</small><strong>{summary.rowCount}</strong></div>
        <div><small>{adminT("Original expenses")}</small><strong>{euro(summary.totalCostCents, adminLocale)}</strong></div>
        <div><small>{adminT("Separate recharge")}</small><strong>{euro(summary.pricedRechargeCents, adminLocale)}</strong></div>
        <div><small>{adminT("Items to review")}</small><strong>{summary.reviewCount}</strong></div>
      </div>
      <p className={styles.hint}>
        {summary.rechargeCount}  {adminT("rows contain a separately specified recharge amount (")}{summary.estimatedBillableHours}  {adminT("estimated billable hours). These are")} <strong>{adminT("not")}</strong>  {adminT("recorded working hours. A previously issued invoice reference is shown only for review; amounts are not added again to income or a new invoice.")}</p>
      <div className={styles.tableScroll}>
        <table aria-label={adminT("Expenses by location")}>
          <thead><tr><th>{adminT("Location")}</th><th>{adminT("Rows")}</th><th>{adminT("Expenses")}</th><th>{adminT("Recharge")}</th><th>{adminT("Review required")}</th></tr></thead>
          <tbody>{summary.groups.map(g=><tr key={g.location}>
            <td>{g.location}</td><td>{g.count}</td><td>{euro(g.costCents, adminLocale)}</td><td>{euro(g.rechargeCents, adminLocale)}</td><td>{g.reviewCount}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.importFilters}>
        <label>{adminT("Location")} <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
          <option value="alle">{adminT("All locations")}</option>
          {summary.groups.map(g=><option key={g.location} value={g.location}>{g.location}</option>)}
        </select></label>
        <label>{adminT("Recharge")} <select value={rechargeFilter} onChange={e=>{setRechargeFilter(e.target.value);setPage(1);}}>
          <option value="alle">{adminT("All statuses")}</option><option value="Ja">{adminT("Yes")}</option>
          <option value="Nee">{adminT("No")}</option><option value="Te beoordelen">{adminT("Awaiting review")}</option>
        </select></label>
      </div>
      <p className={styles.hint}>{filtered.length}  {adminT("detail rows · page")} {page}  {adminT("of")} {pages}{adminT(". Filter by location and recharge status. Original source names are preserved; similar names are grouped only for this overview.")}</p>
      <div className={styles.tableScroll}>
        <table aria-label={adminT("Imported weekly rows")}>
          <thead><tr><th>{adminT("Source")}</th><th>{adminT("Week")}</th><th>{adminT("Location")}</th><th>{adminT("Description")}</th><th>{adminT("Expenses")}</th><th>{adminT("Billing")}</th><th>{adminT("Recharge")}</th></tr></thead>
          <tbody>{shown.map(r=><tr key={r.reference}>
            <td>{r.sourceReference}</td><td>{r.week}</td><td>{r.originalLocation}</td>
            <td>{r.description}</td><td>{euro(r.costCents, adminLocale)}</td><td>{r.recharge==='Ja'?adminT("Yes"):r.recharge==='Nee'?adminT("No"):adminT("Awaiting review")}</td>
            <td>{r.rechargeCents===null?"—":euro(r.rechargeCents, adminLocale)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <nav className={styles.registerActions} aria-label={adminT("Weekly expense pages")}>
       <button type="button" className={styles.saveButton} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>{adminT("Previous page")}</button>
       <button type="button" className={styles.saveButton} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>{adminT("Next page")}</button>
      </nav>
      <div className={styles.blocked}>
        <strong>{adminT("Source quality considerations")}</strong>
        <p>{adminT("Weekly amounts are not individual supporting documents or final time records. The correct payer, legal owner, original invoices and any earlier delivery must still be verified. Automatic onward invoicing is therefore disabled.")}</p>
      </div>
    </>}
  </section>;
}
