"use client";
import {useActionState} from "react";
import {decideCorrection,type CorrectionDecisionState} from "./correction-decision-actions";
const initialFormActionState:CorrectionDecisionState={status:"idle",message:""};
import styles from "./expenses.module.css";
type Proposal={id:string;draft_id:string;reason:string};
type Decision={correction_id:string;decision:string};
function DecisionForm({item}:{item:Proposal}){
 const [state,action,pending]=useActionState(decideCorrection,initialFormActionState);
 return <form action={action} className={styles.fields} style={{margin:"14px 0 25px"}}>
  <input type="hidden" name="correction_id" value={item.id}/>
  <strong>Voorstel voor kostendossier {item.draft_id.slice(0,8)}</strong>
  <p className={styles.hint}>{item.reason}</p>
  <label>Beslissing
   <select name="decision" required defaultValue="replacement_required">
    <option value="replacement_required">Vervangend bewijs en nieuwe beoordeling vereist</option>
    <option value="declined">Correctie afwijzen; oorspronkelijke goedkeuring behouden</option>
   </select>
  </label>
  <label>Reden voor beslissing
   <textarea required minLength={8} maxLength={1000} name="reason" rows={2}
    placeholder="Vermeld waarom deze beslissing is genomen"/>
  </label>
  <label className={styles.approvalLine}><input name="confirmed_immutable_correction" type="checkbox" value="yes" required/> Ik bevestig dat de beslissing uitsluitend fictieve Staging-gegevens betreft en blijvend wordt geregistreerd.</label>
  <button type="submit" disabled={pending} className={styles.saveButton}>
   {pending?"Beslissing vastleggen…":"Beslissing registreren op Staging"}
  </button>
  {state.message&&<p role="status" className={state.status==="error"?styles.error:styles.hint}>{state.message}</p>}
 </form>;
}
export default function CorrectionDecisions({
 proposals,decisions,enabled
}:{proposals:Proposal[];decisions:Decision[];enabled:boolean}){
 const decided=new Map(decisions.map(d=>[d.correction_id,d.decision]));
 return <section className={styles.panel} style={{marginTop:22}} aria-labelledby="correction-decision">
  <p className={styles.kicker}>07B / CORRECTIEBESLISSINGEN</p>
  <h2 id="correction-decision">Beslissen over een correctievoorstel</h2>
  <p className={styles.hint}>Beslissingen zijn definitief vastgelegd. Een vervanging wordt niet zonder nieuw bewijs als bijgewerkt bedrag geboekt.</p>
  {!enabled?<p className={styles.error} role="alert">Correctiebeslissingen zijn niet volledig beschikbaar.</p>:
   proposals.length===0?<p className={styles.hint}>Nog geen correctievoorstellen.</p>:
   proposals.map(p=><div key={p.id} style={{borderTop:"1px solid #66553c",marginTop:16}}>
    {decided.has(p.id)?
      <p className={styles.hint}>Dossier {p.draft_id.slice(0,8)} — {decided.get(p.id)==="declined"?"Afgewezen":"Vervangingsdocument vereist"}</p>:
      <DecisionForm item={p}/>}
   </div>)}
 </section>;
}
