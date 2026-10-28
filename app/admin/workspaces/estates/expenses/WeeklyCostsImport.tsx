"use client";

import {useMemo,useRef,useState} from "react";
import {parseWeeklyCostsCsv,summarizeWeeklyCosts,
  weeklyCostsTemplate, type ImportedWeeklyCost} from "../../../../../lib/property-operations/weekly-import";
import styles from "./expenses.module.css";

const euro = (value:number) => new Intl.NumberFormat("nl-NL", {
  style:"currency",currency:"EUR"
}).format(value/100);

export default function WeeklyCostsImport(){
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
    const a=document.createElement("a");a.href=url;a.download="mzs-weekkosten-voorbeeld.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function readFile(file:File|undefined){
    const version=++readVersion.current;
    setPage(1);setRows([]);setError("");setFilter("alle");setRechargeFilter("alle");setSourceName("");
    if(!file)return;
    if(file.size>1500000 || !/\.csv$/i.test(file.name)){
      setError("Selecteer een CSV-bestand van maximaal 1,5 MB.");
      return;
    }
    try {
      const text=await file.text();
      if(version!==readVersion.current)return;
      const loaded=parseWeeklyCostsCsv(text);
      setRows(loaded);setSourceName(file.name);
    }catch(e){if(version!==readVersion.current)return;setError(e instanceof Error?e.message:"CSV kon niet worden gecontroleerd.");}
  }

  return <section className={styles.panel} aria-labelledby="weekly-costs-import" style={{marginTop:22}}>
    <p className={styles.kicker}>04 / WEEKKOSTENCONTROLE</p>
    <h2 id="weekly-costs-import">Weekopgaven controleren</h2>
    <p className={styles.hint}>Laad een eerder samengesteld weekkosten-CSV vanaf je eigen apparaat. Het bestand wordt uitsluitend in deze browser verwerkt:
      niet geüpload, niet opgeslagen in de database en niet gedeeld met GitHub of andere diensten.
      Sluit de pagina om de gegevens uit dit overzicht te verwijderen.</p>
    <div className={styles.fields} style={{marginTop:18}}>
      <label>Weekkostenbestand (.csv)
        <input key={inputVersion} type="file" accept=".csv,text/csv" onChange={e=>{void readFile(e.currentTarget.files?.[0]);}}/>
      </label>
    </div>
    <div className={styles.registerActions}><button type="button" className={styles.saveButton} onClick={template}>Download CSV-voorbeeld</button><button type="button" className={styles.saveButton} onClick={clear}>Wis ingelezen gegevens</button></div>
    <p className={styles.hint}>Het voorbeeld bevat uitsluitend fictieve gegevens en toont de verwachte kolommen. De samenvatting hieronder betreft het volledige bestand; filters gelden voor de detailregels.</p>
    {error&&<p role="alert" className={styles.error}>{error} De import is volledig afgewezen; er zijn geen deelbedragen ingeladen.</p>}
    {summary&&<>
      <p className={styles.hint}>Gelezen: {sourceName}. <strong>Alleen controleberekening; geen financiële boeking.</strong></p>
      <div className={styles.importCards}>
        <div><small>Bronregels</small><strong>{summary.rowCount}</strong></div>
        <div><small>Oorspronkelijke kosten</small><strong>{euro(summary.totalCostCents)}</strong></div>
        <div><small>Afzonderlijke doorbelasting</small><strong>{euro(summary.pricedRechargeCents)}</strong></div>
        <div><small>Te beoordelen posten</small><strong>{summary.reviewCount}</strong></div>
      </div>
      <p className={styles.hint}>
        {summary.rechargeCount} regels bevatten een apart gespecificeerd doorbelastingsbedrag ({summary.estimatedBillableHours} geschatte factureerbare uren).
        Dit zijn <strong>geen</strong> geregistreerde werktijden. Een eerder opgemaakte factuurreferentie wordt uitsluitend ter controle getoond;
        de bedragen worden niet opnieuw aan inkomsten of een nieuwe factuur toegevoegd.
      </p>
      <div className={styles.tableScroll}>
        <table aria-label="Kosten per locatie">
          <thead><tr><th>Locatie</th><th>Regels</th><th>Kosten</th><th>Doorbelasting</th><th>Controle nodig</th></tr></thead>
          <tbody>{summary.groups.map(g=><tr key={g.location}>
            <td>{g.location}</td><td>{g.count}</td><td>{euro(g.costCents)}</td><td>{euro(g.rechargeCents)}</td><td>{g.reviewCount}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={styles.importFilters}>
        <label>Locatie <select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
          <option value="alle">Alle locaties</option>
          {summary.groups.map(g=><option key={g.location} value={g.location}>{g.location}</option>)}
        </select></label>
        <label>Doorbelasting <select value={rechargeFilter} onChange={e=>{setRechargeFilter(e.target.value);setPage(1);}}>
          <option value="alle">Alle statussen</option><option value="Ja">Ja</option>
          <option value="Nee">Nee</option><option value="Te beoordelen">Te beoordelen</option>
        </select></label>
      </div>
      <p className={styles.hint}>{filtered.length} detailregels · pagina {page} van {pages}. Filter op locatie en doorbelasting. Originele bronbenamingen blijven behouden; vergelijkbare benamingen worden alleen voor dit overzicht gegroepeerd.</p>
      <div className={styles.tableScroll}>
        <table aria-label="Ingelezen weekregels">
          <thead><tr><th>Bron</th><th>Week</th><th>Locatie</th><th>Omschrijving</th><th>Kosten</th><th>Facturatie</th><th>Doorbelasting</th></tr></thead>
          <tbody>{shown.map(r=><tr key={r.reference}>
            <td>{r.sourceReference}</td><td>{r.week}</td><td>{r.originalLocation}</td>
            <td>{r.description}</td><td>{euro(r.costCents)}</td><td>{r.recharge}</td>
            <td>{r.rechargeCents===null?"—":euro(r.rechargeCents)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <nav className={styles.registerActions} aria-label="Pagina’s met weekkosten">
       <button type="button" className={styles.saveButton} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Vorige pagina</button>
       <button type="button" className={styles.saveButton} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Volgende pagina</button>
      </nav>
      <div className={styles.blocked}>
        <strong>Rekening houden met bronkwaliteit</strong>
        <p>Weekbedragen zijn geen afzonderlijke bewijsstukken of definitieve urenregistraties.
          De juiste betaler, juridische eigenaar, oorspronkelijke facturen en eventuele eerdere verzending
          moeten nog worden geverifieerd. Automatisch doorfactureren is daarom uitgeschakeld.</p>
      </div>
    </>}
  </section>;
}
