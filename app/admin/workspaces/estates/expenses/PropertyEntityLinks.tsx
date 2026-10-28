import {initialFormActionState} from "../../../../../lib/property-operations/form-state";
"use client";

import {useActionState} from "react";
import {addVerifiedPropertyEntityLink} from "./entity-link-actions";
import styles from "./expenses.module.css";

type Named={id:string;name:string};
type Existing={
  id:string;property_id:string;legal_entity_id:string;
  relationship_type:string;effective_from:string;verified_at:string;evidence_reference:string;
};
const relationNames:{[key:string]:string}={owner:"Juridische eigenaar",payer:"Kostendrager / betaler",manager:"Beheerder"};
export default function PropertyEntityLinks({
 properties,issuers,links,enabled
}:{properties:Named[];issuers:Named[];links:Existing[];enabled:boolean}){
 const [state,action,pending]=useActionState(addVerifiedPropertyEntityLink,initialFormActionState);
 const propertyName=(id:string)=>properties.find(x=>x.id===id)?.name||"Onbekend object";
 const issuerName=(id:string)=>issuers.find(x=>x.id===id)?.name||"Onbekende entiteit";
 return <section className={styles.panel} aria-labelledby="entity-links" style={{marginTop:22}}>
  <p className={styles.kicker}>04 / JURIDISCHE OBJECTKOPPELING</p>
  <h2 id="entity-links">Entiteit aan object koppelen</h2>
  <p className={styles.hint}>Deze expliciete koppeling bepaalt straks welke entiteit kosten voor een object kan dragen. Het opslaan betekent <strong>niet</strong> dat automatisch facturen of kosten worden aangemaakt.</p>
  {links.length>0&&<div className={styles.tableScroll} style={{marginTop:17}}>
   <table aria-label="Bestaande geverifieerde objectkoppelingen">
    <thead><tr><th>Object</th><th>Entiteit</th><th>Relatie</th><th>Geldig vanaf</th><th>Bron</th></tr></thead>
    <tbody>{links.map(link=><tr key={link.id}>
      <td>{propertyName(link.property_id)}</td>
      <td>{issuerName(link.legal_entity_id)}</td>
      <td>{relationNames[link.relationship_type]||link.relationship_type}</td>
      <td>{link.effective_from}</td>
      <td>{link.evidence_reference}</td>
    </tr>)}</tbody>
   </table>
  </div>}
  {!enabled&&<p className={styles.error} role="alert">Toewijzingen zijn niet beschikbaar: de Staging-schema-uitbreiding ontbreekt of het register kon niet veilig worden gelezen.</p>}
  {enabled&&<form action={action} className={styles.fields} style={{marginTop:20}}>
    <div className={styles.twoFields}>
      <label>Vastgoedobject <select name="property_id" required defaultValue="">
        <option value="" disabled>Selecteer object</option>
        {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label>Juridische entiteit <select name="legal_entity_id" required defaultValue="">
        <option value="" disabled>Selecteer entiteit</option>
        {issuers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
    </div>
    <div className={styles.twoFields}>
      <label>Type relatie <select name="relationship_type" defaultValue="payer">
        <option value="payer">Kostendrager / betaler</option>
        <option value="owner">Juridische eigenaar</option>
        <option value="manager">Beheerder</option>
      </select></label>
      <label>Ingangsdatum <input type="date" name="effective_from" required/></label>
    </div>
    <label>Gecontroleerde bron of bewijs
      <input name="evidence_reference" type="text" minLength={6} maxLength={500} required placeholder="Bijvoorbeeld eigendomsakte, huurovereenkomst of schriftelijke toestemming"/>
    </label>
    <label className={styles.approvalLine}>
      <input type="checkbox" name="confirmed" value="yes" required/>
      <span>Ik heb gecontroleerd dat deze entiteit daadwerkelijk deze relatie met het object heeft. Ik begrijp dat deze toewijzing als controlehistorie wordt vastgelegd.</span>
    </label>
    <button type="submit" disabled={pending} className={styles.saveButton}>{pending?"Bezig met opslaan…":"Koppeling controleren en opslaan op Staging"}</button>
    {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.notice}>{state.message}</p>}
    <p className={styles.hint}>Koppelingen worden in deze eerste fase niet automatisch gewijzigd of verwijderd. Correcties gaan later via een afzonderlijke gecontroleerde workflow.</p>
  </form>}
 </section>;
}
