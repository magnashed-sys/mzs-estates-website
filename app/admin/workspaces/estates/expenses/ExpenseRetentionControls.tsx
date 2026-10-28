"use client";
import {useActionState} from "react";
import {proposeEvidenceRetention,placeEvidenceHold,type RetentionState} from "./retention-actions";
import styles from "./expenses.module.css";
type Named={id:string;name:string};
type Evidence={id:string;draft_id:string};
type Proposal={id:string;legal_entity_id:string;jurisdiction_code:string;proposed_years:number;legal_source_reference:string;status:string};
type Hold={id:string;document_id:string;hold_reason:string;created_at:string};
type Draft={id:string;supplier_invoice_number:string};
const initial:RetentionState={status:"idle",message:""};
function ProposeForm({issuers}: {issuers:Named[]}){
 const [state,action,busy]=useActionState(proposeEvidenceRetention,initial);
 return <form action={action} className={styles.fields} style={{marginTop:16}}>
  <label>Juridische entiteit <select name="legal_entity_id" defaultValue="" required>
   <option value="" disabled>Kies een entiteit</option>
   {issuers.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
  </select></label>
  <div className={styles.twoFields}>
   <label>Landcode (ISO, bijv. NL of ES)
    <input name="jurisdiction_code" maxLength={2} minLength={2} pattern="[A-Za-z]{2}" required placeholder="NL"/>
   </label>
   <label>Voorgestelde termijn (jaren)
    <input name="proposed_years" type="number" min={1} max={30} step={1} required placeholder="Nog te verifiëren"/>
   </label>
  </div>
  <label>Te controleren wettelijke of contractuele grondslag
   <textarea name="legal_source_reference" minLength={12} maxLength={1000} required rows={3}
    placeholder="Vermeld rechtsbron of vraagstelling voor de lokale accountant; dit is géén vaststelling."/>
  </label>
  <label className={styles.approvalLine}>
   <input type="checkbox" name="confirmed_legal_review" value="yes" required/>
   Ik bevestig dat dit een niet-bindend voorstel voor de lokale accountant is. Er wordt geen automatische verwijdertermijn geactiveerd.
  </label>
  <button className={styles.saveButton} disabled={busy||issuers.length===0} type="submit">
   {busy?"Voorstel vastleggen…":"Voorgestelde termijn registreren"}
  </button>
  {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.hint}>{state.message}</p>}
 </form>;
}
function HoldForm({documents,drafts,holds}: {documents:Evidence[];drafts:Draft[];holds:Hold[]}){
 const [state,action,busy]=useActionState(placeEvidenceHold,initial);
 const held=new Set(holds.map(x=>x.document_id));
 const invoiceName=new Map(drafts.map(x=>[x.id,x.supplier_invoice_number]));
 const eligible=documents.filter(x=>!held.has(x.id));
 return <form action={action} className={styles.fields} style={{marginTop:16}}>
  <label>Document voor permanente bewaarblokkade
   <select name="document_id" required defaultValue="">
    <option value="" disabled>Kies een geregistreerd bewijsstuk</option>
    {eligible.map(x=><option key={x.id} value={x.id}>{invoiceName.get(x.draft_id)??"Onbekend concept"} · {x.id.slice(0,8)}</option>)}
   </select>
  </label>
  <label>Reden voor legal hold
   <textarea name="hold_reason" minLength={12} maxLength={1000} rows={3} required
    placeholder="Bijvoorbeeld bestaand geschil of specifieke instructie van advocaat; gebruik geen fictieve grondslag voor echte documenten."/>
  </label>
  <label className={styles.approvalLine}>
   <input type="checkbox" name="confirmed_hold" value="yes" required/>
   Ik bevestig dat deze blokkade in deze fase niet kan worden ingetrokken of verwijderd.
  </label>
  <button type="submit" className={styles.saveButton} disabled={busy||eligible.length===0}>
   {busy?"Bewaarblokkade vastleggen…":"Legal hold registreren"}
  </button>
  {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.hint}>{state.message}</p>}
 </form>;
}
export default function ExpenseRetentionControls({issuers,proposals,documents,drafts,holds,enabled}:{
 issuers:Named[];proposals:Proposal[];documents:Evidence[];drafts:Draft[];holds:Hold[];enabled:boolean
}){
 const issuerName=new Map(issuers.map(x=>[x.id,x.name]));
 return <section className={styles.panel} style={{marginTop:22}} aria-labelledby="retention-proposals">
  <p className={styles.kicker}>08 / BEWAARBELEID — STAGING</p>
  <h2 id="retention-proposals">Bewaarbeleid per juridische entiteit</h2>
  <p className={styles.hint}>Er is nog geen juridisch vastgesteld bewaarbeleid. Per land en entiteit registreren we uitsluitend voorstellen die de eigen lokale accountant moet verifiëren. Er wordt nooit automatisch verwijderd.</p>
  {!enabled?<p role="alert" className={styles.error}>Bewaarregister niet volledig beschikbaar. Alle acties zijn geblokkeerd.</p>:<>
   {proposals.length>0&&<div className={styles.tableScroll}><table><thead><tr><th>Juridische entiteit</th><th>Land</th><th>Voorstel</th><th>Status</th><th>Bron</th></tr></thead>
    <tbody>{proposals.map(p=><tr key={p.id}><td>{issuerName.get(p.legal_entity_id)??"Onbekend"}</td>
     <td>{p.jurisdiction_code}</td><td>{p.proposed_years} jaar</td><td>Wacht op lokale accountant</td><td>{p.legal_source_reference}</td></tr>)}</tbody>
   </table></div>}
   <ProposeForm issuers={issuers}/>
   <h3 style={{marginTop:30}}>Documenten met legal hold ({holds.length})</h3>
   <p className={styles.hint}>Legal hold betekent: bewijs behouden en geen geautomatiseerde verwijdering. Het intrekken ervan vereist later een afzonderlijk geautoriseerde procedure.</p>
   {holds.length>0&&<ul>{holds.map(h=><li key={h.id}>{h.document_id.slice(0,8)} — {h.hold_reason}</li>)}</ul>}
   <HoldForm documents={documents} drafts={drafts} holds={holds}/>
  </>}
 </section>;
}
