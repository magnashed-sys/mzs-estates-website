"use client";
import {useActionState} from "react";
import {addPropertyEntityLink,type EntityLinkActionState} from "./actions";
import styles from "./entities.module.css";
const initial:EntityLinkActionState={status:"idle",message:""};
type Option={id:string;name:string};

export default function EntityLinkForm({properties,issuers}:{
 properties:Option[];issuers:Option[];
}){
 const [state,action,pending]=useActionState(addPropertyEntityLink,initial);
 return <section className={styles.panel} aria-labelledby="new-entity-link">
  <p className={styles.kicker}>CONTROLEERDE ADMINISTRATIEVE TOEREKENING</p>
  <h2 id="new-entity-link">Nieuwe koppeling registreren</h2>
  <p className={styles.hint}>Selecteer het bestaande object en de juiste juridische entiteit.
   Deze registratie is een intern bewijs van de opgegeven relatie en bepaalt <strong>niet</strong> automatisch btw,
   eigendomstitel, kosten of te verzenden facturen.</p>
  <form action={action} className={styles.form}>
   <div className={styles.fields}>
    <label>Vastgoedobject
     <select name="property_id" defaultValue="" required>
      <option value="" disabled>Kies het juiste object</option>
      {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>
    <label>Juridische entiteit
     <select name="legal_entity_id" defaultValue="" required>
      <option value="" disabled>Kies de geregistreerde entiteit</option>
      {issuers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
     </select>
    </label>
    <label>Type relatie
     <select name="relationship_type" defaultValue="payer" required>
      <option value="payer">Kostendrager / betaler</option>
      <option value="owner">Juridische eigenaar</option>
      <option value="manager">Beheerder</option>
     </select>
    </label>
    <label>Geldig vanaf
     <input type="date" name="effective_from" required/>
    </label>
   </div>
   <label>Bewijsbron of onderbouwing
    <textarea name="evidence_reference" minLength={6} maxLength={500}
     placeholder="Bijvoorbeeld een gecontroleerde overeenkomst, eigendomsakte of schriftelijke toestemming" required/>
   </label>
   <label className={styles.confirmation}>
    <input type="checkbox" name="confirmed" value="yes" required/>
    <span>Ik heb de relatie en ingangsdatum gecontroleerd. Ik begrijp dat deze koppeling en de bewijsbron
     als onveranderbare controlehistorie worden geregistreerd.</span>
   </label>
   <button disabled={pending||properties.length===0||issuers.length===0} type="submit">
    {pending?"Koppeling opslaan…":"Gecontroleerde koppeling vastleggen"}
   </button>
   {state.message&&<p className={state.status==="error"?styles.error:styles.notice}
     role={state.status==="error"?"alert":"status"}>{state.message}</p>}
  </form>
  <p className={styles.warning}>Een eenmaal geregistreerde koppeling kan in deze fase niet worden
   verwijderd of stilzwijgend aangepast. Maak uitsluitend een registratie nadat je de bewijsgrondslag
   hebt gecontroleerd.</p>
 </section>;
}
