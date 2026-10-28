"use client";

import {useMemo, useState} from "react";
import {expenseAllocationPreview, inputEuroCents, type ExpenseAllocationMode} from "../../../../../lib/property-operations/expense-preview";
import styles from "./expenses.module.css";

type Issuer = {id:string;name:string;kind:string|null;prefix:string};
type Property = {id:string;name:string;address:string;country_code:string};
type Unit = {id:string;property_id:string;address:string};
type Supplier = {id:string;name:string;kind:string|null};
type Props = {issuers:Issuer[];properties:Property[];units:Unit[];suppliers:Supplier[]};

const categories = [
  ["electricity","Elektriciteit"],["gas","Gas"],["water","Water"],
  ["cleaning","Schoonmaak"],["internet","Internet / telecom"],
  ["insurance","Verzekering"],["taxes","Heffingen"],["maintenance","Onderhoud"],
  ["materials","Materialen"],["management","Beheer"],["other","Overige kosten"],
] as const;
const formatCents = (value:number) => new Intl.NumberFormat("nl-NL",{
  style:"currency",currency:"EUR"
}).format(value / 100);

/**
 * Dry-run only: no fetch, server action, local storage, Supabase writes or upload.
 * Display calculations are not a legal entity/property verification.
 */
export default function ExpenseCalculator({issuers,properties,units,suppliers}:Props) {
  const [issuerId,setIssuerId] = useState("");
  const [supplierId,setSupplierId] = useState("");
  const [propertyId,setPropertyId] = useState("");
  const [unitId,setUnitId] = useState("");
  const [mode,setMode] = useState<ExpenseAllocationMode>("property");
  const [invoiceNumber,setInvoiceNumber] = useState("");
  const [invoiceDate,setInvoiceDate] = useState("");
  const [category,setCategory] = useState("electricity");
  const [netInput,setNetInput] = useState("");
  const [vatInput,setVatInput] = useState("");
  const [description,setDescription] = useState("");

  const propertyUnits = useMemo(()=>
    units.filter(unit=>unit.property_id===propertyId).slice().sort((a,b)=>
      a.address.localeCompare(b.address,"nl")), [units,propertyId]);
  const selectedIssuer = issuers.find(issuer=>issuer.id===issuerId);
  const selectedSupplier = suppliers.find(supplier=>supplier.id===supplierId);
  const selectedProperty = properties.find(property=>property.id===propertyId);

  const ready = Boolean(selectedIssuer && selectedSupplier && selectedProperty &&
    invoiceNumber.trim() && invoiceDate && description.trim().length >= 2 &&
    netInput.trim() && vatInput.trim());

  const outcome = useMemo(()=>{
    if(!ready) return null;
    try {
      if(!/^20\d{2}-\d{2}-\d{2}$/.test(invoiceDate) ||
         new Date(invoiceDate+"T00:00:00.000Z").toISOString().slice(0,10)!==invoiceDate)
        throw new Error("Controleer de factuurdatum.");
      if(invoiceNumber.trim().length>100 || /[\r\n]/.test(invoiceNumber))
        throw new Error("Controleer het factuurnummer.");
      if(description.trim().length>500) throw new Error("Omschrijving is te lang.");
      const netCents=inputEuroCents(netInput);
      const vatCents=inputEuroCents(vatInput);
      if(netCents + vatCents === 0) throw new Error("Vul een positief factuurbedrag in.");
      const allocation=expenseAllocationPreview(netCents,vatCents,mode,propertyId,
        propertyUnits.map(unit=>unit.id),unitId);
      return {netCents,vatCents,grossCents:netCents+vatCents,allocation,error:""};
    } catch(err) {
      return {error:err instanceof Error?err.message:"Berekening niet beschikbaar."};
    }
  },[ready,invoiceDate,invoiceNumber,description,netInput,vatInput,mode,propertyId,propertyUnits,unitId]);

  return (
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="expense-entry">
        <p className={styles.kicker}>01 / GEGEVENS</p>
        <h2 id="expense-entry">Nieuwe kostenpost · voorbeeld</h2>
        <div className={styles.fields}>
          <label>Juridische entiteit <select value={issuerId} onChange={e=>setIssuerId(e.target.value)}>
            <option value="">Selecteer een entiteit</option>
            {issuers.map(x=><option key={x.id} value={x.id}>{x.name} ({x.kind==="person"?"privé":"organisatie"})</option>)}
          </select></label>
          <label>Leverancier / relatie <select value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
            <option value="">Selecteer een bestaande relatie</option>
            {suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select></label>
          <div className={styles.twoFields}>
            <label>Factuurnummer leverancier <input value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} maxLength={100} placeholder="Bijvoorbeeld EL-2026-110"/></label>
            <label>Factuurdatum <input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label>
          </div>
          <label>Object <select value={propertyId} onChange={e=>{
            setPropertyId(e.target.value);setUnitId("");setMode("property");
          }}>
            <option value="">Selecteer een object</option>
            {properties.map(x=><option key={x.id} value={x.id}>{x.name} · {x.address}</option>)}
          </select></label>
          <div className={styles.twoFields}>
            <label>Kostensoort <select value={category} onChange={e=>setCategory(e.target.value)}>
              {categories.map(([id,name])=><option key={id} value={id}>{name}</option>)}
            </select></label>
            <label>Verdeling <select value={mode} onChange={e=>{setMode(e.target.value as ExpenseAllocationMode);setUnitId("");}}>
              <option value="property">Volledig object</option>
              <option value="unit" disabled={!propertyUnits.length}>Eén unit</option>
              <option value="equal-units" disabled={!propertyUnits.length}>Gelijk over alle units</option>
            </select></label>
          </div>
          {mode==="unit" && <label>Unit <select value={unitId} onChange={e=>setUnitId(e.target.value)}>
            <option value="">Selecteer een unit</option>
            {propertyUnits.map(x=><option key={x.id} value={x.id}>{x.address}</option>)}
          </select></label>}
          <label>Omschrijving <input value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} placeholder="Bijvoorbeeld elektriciteit oktober"/></label>
          <div className={styles.twoFields}>
            <label>Bedrag excl. btw (€) <input inputMode="decimal" value={netInput} onChange={e=>setNetInput(e.target.value)} placeholder="100,00"/></label>
            <label>Btw volgens factuur (€) <input inputMode="decimal" value={vatInput} onChange={e=>setVatInput(e.target.value)} placeholder="21,00"/></label>
          </div>
        </div>
        <p className={styles.hint}>Btw wordt overgenomen als bedrag van de leveranciersfactuur, niet automatisch gekozen op basis van het land. Je kunt 0,00 invoeren als de factuur geen btw bevat.</p>
      </section>
      <section className={styles.panel} aria-labelledby="expense-preview">
        <p className={styles.kicker}>02 / CONTROLE</p>
        <h2 id="expense-preview">Kostenverdeling</h2>
        {!ready && <div className={styles.placeholder}>Vul entiteit, relatie, object, factuurnummer, datum, omschrijving en bedragen in om de verdeling te bekijken.</div>}
        {outcome && "error" in outcome && outcome.error && <p role="alert" className={styles.error}>{outcome.error}</p>}
        {outcome && "allocation" in outcome && outcome.allocation && <div className={styles.result} aria-live="polite">
          <div className={styles.identity}>
            <strong>{selectedIssuer?.name}</strong>
            <span>Entiteit niet juridisch aan dit object geverifieerd</span>
            <strong>{selectedProperty?.name}</strong>
            <span>{selectedSupplier?.name} · {invoiceNumber.trim()}</span>
            <span>{categories.find(x=>x[0]===category)?.[1]} · {invoiceDate}</span>
          </div>
          <div className={styles.totals}>
            <div><span>Exclusief btw</span><strong>{formatCents(outcome.netCents)}</strong></div>
            <div><span>Btw (ingevoerd)</span><strong>{formatCents(outcome.vatCents)}</strong></div>
            <div className={styles.grandTotal}><span>Totaal</span><strong>{formatCents(outcome.grossCents)}</strong></div>
          </div>
          <h3>Verdeling van kosten</h3>
          <div className={styles.tableScroll}><table>
            <thead><tr><th>Object / unit</th><th>Excl. btw</th><th>Btw</th><th>Incl. btw</th></tr></thead>
            <tbody>{outcome.allocation.map(x=><tr key={x.targetId}>
              <td>{propertyUnits.find(u=>u.id===x.targetId)?.address || selectedProperty?.name}</td>
              <td>{formatCents(x.netCents)}</td>
              <td>{formatCents(x.vatCents)}</td>
              <td>{formatCents(x.grossCents)}</td>
            </tr>)}</tbody>
          </table></div>
          <p className={styles.hint}>Verdeling in exacte centen; geen afrondingsverschil. Deze berekening is nog niet opgeslagen of goedgekeurd.</p>
        </div>}
        <div className={styles.blocked}>
          <strong>Opslaan, uploaden en doorfactureren zijn nog uitgeschakeld.</strong>
          <p>De eerste database-uitbreiding, object-entiteitskoppelingen, documentbeveiliging en goedkeuringsproces moeten vóór ingebruikname worden getest.</p>
        </div>
      </section>
    </div>
  );
}
