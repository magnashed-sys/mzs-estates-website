"use client";

import {useMemo, useState} from "react";
import {expenseAllocationPreview, inputEuroCents, type ExpenseAllocationMode} from "../../../../../lib/property-operations/expense-preview";
import styles from "./expenses.module.css";
import ExpenseDraftSaver,{type PayerLink,type DraftSelection} from "./ExpenseDraftSaver";

type Issuer = {id:string;name:string;kind:string|null;prefix:string};
type Property = {id:string;name:string;address:string;country_code:string};
type Unit = {id:string;property_id:string;address:string};
type Supplier = {id:string;name:string;kind:string|null};
type Props = {issuers:Issuer[];properties:Property[];units:Unit[];suppliers:Supplier[];payerLinks:PayerLink[];canSaveDraft:boolean};

const categories = [
  ["electricity","Elektriciteit"],["gas","Gas"],["water","Water"],
  ["cleaning","Schoonmaak"],["internet","Internet / telecom"],
  ["insurance","Verzekering"],["taxes","Heffingen"],["maintenance","Maintenance"],
  ["materials","Materialen"],["management","Beheer"],["other","Other expenses"],
] as const;
const formatCents = (value:number) => new Intl.NumberFormat("en-GB",{
  style:"currency",currency:"EUR"
}).format(value / 100);

/**
 * Dry-run only: no fetch, server action, local storage, Supabase writes or upload.
 * Display calculations are not a legal entity/property verification.
 */
export default function ExpenseCalculator({issuers,properties,units,suppliers,payerLinks,canSaveDraft}:Props) {
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
        throw new Error("Check the invoice date.");
      if(invoiceNumber.trim().length>100 || /[\r\n]/.test(invoiceNumber))
        throw new Error("Check the invoice number.");
      if(description.trim().length>500) throw new Error("Description is too long.");
      const netCents=inputEuroCents(netInput);
      const vatCents=inputEuroCents(vatInput);
      if(netCents + vatCents === 0) throw new Error("Enter a positive invoice amount.");
      const allocation=expenseAllocationPreview(netCents,vatCents,mode,propertyId,
        propertyUnits.map(unit=>unit.id),unitId);
      return {netCents,vatCents,grossCents:netCents+vatCents,allocation,error:""};
    } catch(err) {
      return {error:err instanceof Error?err.message:"Calculation unavailable."};
    }
  },[ready,invoiceDate,invoiceNumber,description,netInput,vatInput,mode,propertyId,propertyUnits,unitId]);

  const draftSelection:DraftSelection|null = outcome && "allocation" in outcome && outcome.allocation ? {
    propertyId,entityId:issuerId,supplierId,invoiceNumber:invoiceNumber.trim(),
    invoiceDate,category,description:description.trim(),
    netCents:outcome.netCents,vatCents:outcome.vatCents,
    allocation:outcome.allocation.map(x=>({targetId:x.targetId,netCents:x.netCents,vatCents:x.vatCents}))
  } : null;
  return (
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="expense-entry">
        <p className={styles.kicker}>01 / DETAILS</p>
        <h2 id="expense-entry">Purchase expenses · draft calculation</h2>
        <div className={styles.fields}>
          <label>Legal entity <select value={issuerId} onChange={e=>setIssuerId(e.target.value)}>
            <option value="">Select an entity</option>
            {issuers.map(x=><option key={x.id} value={x.id}>{x.name} ({x.kind==="person"?"privé":"organisatie"})</option>)}
          </select></label>
          <label>Supplier / relationship <select value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
            <option value="">Select an existing relationship</option>
            {suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
          </select></label>
          <div className={styles.twoFields}>
            <label>Supplier invoice number <input value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} maxLength={100} placeholder="Bijvoorbeeld EL-2026-110"/></label>
            <label>Invoice date <input type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label>
          </div>
          <label>Property <select value={propertyId} onChange={e=>{
            setPropertyId(e.target.value);setUnitId("");setMode("property");
          }}>
            <option value="">Select a property</option>
            {properties.map(x=><option key={x.id} value={x.id}>{x.name} · {x.address}</option>)}
          </select></label>
          <div className={styles.twoFields}>
            <label>Expense category <select value={category} onChange={e=>setCategory(e.target.value)}>
              {categories.map(([id,name])=><option key={id} value={id}>{name}</option>)}
            </select></label>
            <label>Allocation <select value={mode} onChange={e=>{setMode(e.target.value as ExpenseAllocationMode);setUnitId("");}}>
              <option value="property">Entire property</option>
              <option value="unit" disabled={!propertyUnits.length}>One unit</option>
              <option value="equal-units" disabled={!propertyUnits.length}>Equally across all units</option>
            </select></label>
          </div>
          {mode==="unit" && <label>Unit <select value={unitId} onChange={e=>setUnitId(e.target.value)}>
            <option value="">Select a unit</option>
            {propertyUnits.map(x=><option key={x.id} value={x.id}>{x.address}</option>)}
          </select></label>}
          <label>Description <input value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} placeholder="Bijvoorbeeld elektriciteit oktober"/></label>
          <div className={styles.twoFields}>
            <label>Amount excl. VAT (€) <input inputMode="decimal" value={netInput} onChange={e=>setNetInput(e.target.value)} placeholder="100,00"/></label>
            <label>VAT shown on invoice (€) <input inputMode="decimal" value={vatInput} onChange={e=>setVatInput(e.target.value)} placeholder="21,00"/></label>
          </div>
        </div>
        <p className={styles.hint}>VAT is taken from the supplier invoice as an amount, not chosen automatically by country. Enter zero if the invoice has no VAT.</p>
      </section>
      <section className={styles.panel} aria-labelledby="expense-preview">
        <p className={styles.kicker}>02 / REVIEW</p>
        <h2 id="expense-preview">Expense allocation</h2>
        {!ready && <div className={styles.placeholder}>Enter the entity, relationship, property, invoice number, date, description and amounts to preview the allocation.</div>}
        {outcome && "error" in outcome && outcome.error && <p role="alert" className={styles.error}>{outcome.error}</p>}
        {outcome && "allocation" in outcome && outcome.allocation && <div className={styles.result} aria-live="polite">
          <div className={styles.identity}>
            <strong>{selectedIssuer?.name}</strong>
            <span>{payerLinks.some(l=>l.property_id===propertyId&&l.legal_entity_id===issuerId&&l.effective_from<=invoiceDate&&(l.effective_until===null||l.effective_until>=invoiceDate)) ? "Cost-bearing entity verified for this invoice date" : "Cost-bearing entity not yet verified for this invoice date"}</span>
            <strong>{selectedProperty?.name}</strong>
            <span>{selectedSupplier?.name} · {invoiceNumber.trim()}</span>
            <span>{categories.find(x=>x[0]===category)?.[1]} · {invoiceDate}</span>
          </div>
          <div className={styles.totals}>
            <div><span>Excluding VAT</span><strong>{formatCents(outcome.netCents)}</strong></div>
            <div><span>VAT (entered)</span><strong>{formatCents(outcome.vatCents)}</strong></div>
            <div className={styles.grandTotal}><span>Total</span><strong>{formatCents(outcome.grossCents)}</strong></div>
          </div>
          <h3>Expense allocation</h3>
          <div className={styles.tableScroll}><table>
            <thead><tr><th>Property / unit</th><th>Excl. VAT</th><th>VAT</th><th>Incl. VAT</th></tr></thead>
            <tbody>{outcome.allocation.map(x=><tr key={x.targetId}>
              <td>{propertyUnits.find(u=>u.id===x.targetId)?.address || selectedProperty?.name}</td>
              <td>{formatCents(x.netCents)}</td>
              <td>{formatCents(x.vatCents)}</td>
              <td>{formatCents(x.grossCents)}</td>
            </tr>)}</tbody>
          </table></div>
          <p className={styles.hint}>Allocated in exact cents with no rounding difference. This calculation has not been saved or approved yet.</p>
        </div>}
        <ExpenseDraftSaver selection={draftSelection} payerLinks={payerLinks} available={canSaveDraft} enabled={canSaveDraft}/>
        <div className={styles.blocked}>
          <strong>Approval, source documents and onward invoicing are still disabled.</strong>
          <p>Expense drafts can only be recorded after a verified property-to-entity association. Uploads, payments and final invoices are developed and checked separately.</p>
        </div>
      </section>
    </div>
  );
}
