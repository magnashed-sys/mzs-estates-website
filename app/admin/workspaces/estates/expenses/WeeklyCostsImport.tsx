"use client";

import {useMemo,useState} from "react";
import {parseWeeklyCostsCsv,summarizeWeeklyCosts,
  type ImportedWeeklyCost} from "../../../../../lib/property-operations/weekly-import";
import styles from "./expenses.module.css";

const euro = (value:number) => new Intl.NumberFormat("nl-NL", {
  style:"currency",currency:"EUR"
}).format(value/100);

export default function WeeklyCostsImport(){
  const [rows,setRows]=useState<ImportedWeeklyCost[]>([]);
  const [error,setError]=useState("");
  const [sourceName,setSourceName]=useState("");
  const [filter,setFilter]=useState("alle");
  const [rechargeFilter,setRechargeFilter]=useState("alle");

  const summary=useMemo(()=>rows.length?summarizeWeeklyCosts(rows):null,[rows]);
  const shown=useMemo(()=>rows.filter(r=>
    (filter==="alle"||r.location===filter) &&
    (rechargeFilter==="alle"||r.recharge===rechargeFilter)
  ).slice(0,60),[rows,filter,rechargeFilter]);

  async function readFile(file:File|undefined){
    setRows([]);setError("");setFilter("alle");setRechargeFilter("alle");setSourceName("");
    if(!file)return;
    if(file.size>1500000 || !/\.csv$/i.test(file.name)){
      setError("Selecteer een CSV-bestand van maximaal 1,5 MB.");
      return;
    }
    try {
      const text=await file.text();
      const loaded=parseWeeklyCostsCsv(text);
      setRows(loaded);setSourceName(file.name);
    }catch(e){setError(e instanceof Error?e.message:"CSV kon niet worden gecontroleerd.");}
  }

  return <section className={styles.panel} aria-labelledby="weekly-costs-import" style={{marginTop:22}}>
    <p className={styles.kicker}>03 / LOKALE PRAKTIJKTEST</p>
    <h2 id="weekly-costs-import">Weekopgaven controleren</h2>
    <p className={styles.hint}>Laad een eerder samengesteld weekkosten-CSV vanaf je eigen apparaat. Het bestand wordt uitsluitend in deze browser verwerkt:
      niet geüpload, niet opgeslagen in de database en niet gedeeld met GitHub of andere diensten.
      Sluit de pagina om de gegevens uit deze test te verwijderen.</p>
    <div className={styles.fields} style={{marginTop:18}}>
      <label>Testbestand (.csv)
        <input type="file" accept=".csv,text/csv" onChange={e=>{void readFile(e.currentTarget.files?.[0]);}}/>
      </label>
    </div>
    {error&&<p role="alert" className={styles.error}>{error} De import is volledig afgewezen; er zijn geen deelbedragen ingeladen.</p>}
    {summary&&<>
      <p className={styles.hint}>Gelezen: {sourceName}. **Alleen proefberekening; geen financiële boeking.**</p>
      <div className={styles.importCards}>
        <div><small>Bronregels</small><strong>{summary.rowCount}</strong></div>
        <div><small>Oorspronkelijke kosten</small><strong>{euro(summary.totalCostCents)}</strong></div>
        <div><small>Afzonderlijke doorbelasting</small><strong>{euro(summary.pricedRechargeCents)}</strong></div>
        <div><small>Te beoordelen posten</small><strong>{summary.reviewCount}</strong></div>
      </div>
      <p className={styles.hint}>
        {summary.rechargeCount} regels bevatten een apart gespecificeerd doorbelastingsbedrag ({summary.estimatedBillableHours} geschatte factureerbare uren).
        Dit zijn **geen** geregistreerde werktijden. Een eerder opgemaakte factuurreferentie wordt uitsluitend ter controle getoond;
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
        <label>Locatie <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="alle">Alle locaties</option>
          {summary.groups.map(g=><option key={g.location} value={g.location}>{g.location}</option>)}
        </select></label>
        <label>Doorbelasting <select value={rechargeFilter} onChange={e=>setRechargeFilter(e.target.value)}>
          <option value="alle">Alle statussen</option><option value="Ja">Ja</option>
          <option value="Nee">Nee</option><option value="Te beoordelen">Te beoordelen</option>
        </select></label>
      </div>
      <p className={styles.hint}>Detailregels: maximaal 60 zichtbaar. Filter op locatie en doorbelasting. Originele bronbenamingen blijven behouden; vergelijkbare benamingen worden alleen voor dit overzicht gegroepeerd.</p>
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
      <div className={styles.blocked}>
        <strong>Rekening houden met bronkwaliteit</strong>
        <p>Weekbedragen zijn geen afzonderlijke bewijsstukken of definitieve urenregistraties.
          De juiste betaler, juridische eigenaar, oorspronkelijke facturen en eventuele eerdere verzending
          moeten nog worden geverifieerd. Automatisch doorfactureren is daarom uitgeschakeld.</p>
      </div>
    </>}
  </section>;
}
