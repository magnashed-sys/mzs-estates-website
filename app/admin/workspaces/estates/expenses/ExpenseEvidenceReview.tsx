"use client";

import {useActionState,useState} from "react";
import {useRouter} from "next/navigation";
import {changeExpenseReview,type ReviewActionState} from "./evidence-review-actions";
const initialFormActionState:ReviewActionState={status:"idle",message:""};
import styles from "./expenses.module.css";

type Cost={id:string;supplier_invoice_number:string;invoice_date:string;status:string};
type Evidence={id:string;draft_id:string;sha256:string;mime_type:string;file_size:number};
type Event={draft_id:string;sequence_no:number;action:string;created_at:string};
type Props={drafts:Cost[];documents:Evidence[];events:Event[];enabled:boolean};
function DraftReviewForm({draft,state}: {draft:Cost;state:"draft"|"submitted"|"approved"|"rejected"}) {
 const [result,action,pending]=useActionState(changeExpenseReview,initialFormActionState);
 const [decision,setDecision]=useState<"submitted"|"approved"|"rejected">(
  state==="draft"?"submitted":"approved");
 const permitted=state==="draft"||state==="submitted";
 if(!permitted)return <span className={styles.hint}>{state==="approved"?"Goedgekeurd – definitief":"Afgewezen – correctieworkflow volgt"}</span>;
 return <form action={action} className={styles.evidenceActions}>
   <input type="hidden" name="draft_id" value={draft.id}/>
   <input type="hidden" name="expected_state" value={state}/>
   {state==="submitted"&&<label>Beslissing
    <select value={decision} onChange={e=>setDecision(e.target.value as "approved"|"rejected")}>
     <option value="approved">Goedkeuren</option><option value="rejected">Afwijzen</option>
    </select></label>}
   <input type="hidden" name="review_action" value={state==="draft"?"submitted":decision}/>
   {state==="submitted"&&decision==="rejected"&&<label>Afwijsreden
     <input type="text" required name="reason" minLength={8} maxLength={1000} placeholder="Beschrijf waarom correctie nodig is"/>
   </label>}
   <label className={styles.approvalLine}><input type="checkbox" name="confirmed_synthetic_review" value="yes" required/> Ik bevestig dat uitsluitend fictieve Staging-testgegevens worden beoordeeld. Geen financiële boeking.</label>
   <button className={styles.saveButton} type="submit" disabled={pending}>
     {pending?"Bezig…":state==="draft"?"Indienen ter controle":"Beslissing vastleggen"}
   </button>
   {result.message&&<p role="status" className={result.status==="error"?styles.error:styles.hint}>{result.message}</p>}
  </form>;
}
export default function ExpenseEvidenceReview({drafts,documents,events,enabled}:Props){
 const [draftId,setDraftId]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [syntheticConfirmed,setSyntheticConfirmed]=useState(false);
 const [message,setMessage]=useState("");
 const router=useRouter();
 const latest=new Map<string,Event>();
 for(const event of events){
  const prior=latest.get(event.draft_id);
  if(!prior||event.sequence_no>prior.sequence_no)latest.set(event.draft_id,event);
 }
 const byDraft=new Map(documents.map(d=>[d.draft_id,d]));
 const chosenDoc=byDraft.get(draftId);
 const chosenReview=latest.get(draftId);
 const canUpload=enabled&&!!draftId&&!chosenDoc&&!chosenReview&&!!file&&file.type==="application/pdf"&&syntheticConfirmed&&!busy;
 async function upload(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!canUpload)return;
  setBusy(true);setMessage("");
  try{
   const form=new FormData();
   form.set("draft_id",draftId);
   form.set("file",file!);
   form.set("confirmed_synthetic_file","yes");
   const response=await fetch("/admin/workspaces/estates/expenses/documents",{
     method:"POST",body:form,credentials:"same-origin",cache:"no-store"
   });
   const data:unknown=await response.json();
   const result=data as {ok?:boolean;message?:string};
   if(!response.ok||!result.ok)throw new Error(result.message||"Bestand is niet opgeslagen.");
   setFile(null);setSyntheticConfirmed(false);setMessage("Fictief PDF-bestand gekoppeld. Controleer het Staging-dossier.");
   router.refresh();
  }catch(err){setMessage(err instanceof Error?err.message:"Upload mislukt.");}
  finally{setBusy(false);}
 }
 return <section className={styles.panel} style={{marginTop:22}} aria-labelledby="evidence-heading">
  <p className={styles.kicker}>06 / BRONDOCUMENTEN EN CONTROLE</p>
  <h2 id="evidence-heading">Originele factuur &amp; goedkeuring</h2>
  <p className={styles.hint}>Uitsluitend MZS Staging met fictieve PDF-testbestanden. Privé-opslag, SHA-256-integriteitswaarde en geen overschrijven. Er is nog geen malware-scanner of formele bewaartermijn geïmplementeerd; upload daarom nooit echte leveranciersdocumenten.</p>
  {!enabled?<p className={styles.error} role="alert">Documentregister of controlehistorie is niet volledig beschikbaar. Uploaden en beoordelen zijn geblokkeerd.</p>:
   <><form onSubmit={upload} className={styles.fields} style={{marginTop:20}}>
    <label>Geregistreerd kostenconcept
     <select value={draftId} onChange={e=>{setDraftId(e.target.value);setFile(null);setSyntheticConfirmed(false);setMessage("");}}>
      <option value="">Selecteer concept</option>
      {drafts.map(d=><option key={d.id} value={d.id}>{d.supplier_invoice_number} · {d.invoice_date}</option>)}
     </select>
    </label>
    {draftId&&<p className={styles.hint}>{chosenDoc?
      "Voor dit concept is al een origineel bestand opgeslagen.":
      chosenReview?"Concept is eerder beoordeeld; upload geblokkeerd.":
      "Dit concept heeft nog geen brondocument."}</p>}
    {!chosenDoc&&!chosenReview&&draftId&&<label>Fictief PDF-testdocument (maximaal 4 MB)
     <input type="file" accept=".pdf,application/pdf"
      onChange={e=>{setFile(e.target.files?.[0]||null);setSyntheticConfirmed(false);}}/>
    </label>}
    {draftId&&!chosenDoc&&!chosenReview&&<label className={styles.approvalLine}><input type="checkbox" checked={syntheticConfirmed} onChange={e=>setSyntheticConfirmed(e.target.checked)}/> Ik bevestig dat dit een volledig fictief PDF-testbestand zonder echte persoonsgegevens of leveranciersgegevens is.</label>}
    <button className={styles.saveButton} disabled={!canUpload} type="submit">{busy?"Bezig…":"Origineel veilig koppelen"}</button>
    {message&&<p role="status" className={message.includes("mislukt")?styles.error:styles.hint}>{message}</p>}
   </form>
   <div className={styles.tableScroll} style={{marginTop:20}}>
    <table aria-label="Brondocumenten en status">
      <thead><tr><th>Inkoopconcept</th><th>Origineel</th><th>Controle</th><th>Actie</th></tr></thead>
      <tbody>{drafts.map(d=>{
       const doc=byDraft.get(d.id),event=latest.get(d.id),state=(event?.action??"draft") as "draft"|"submitted"|"approved"|"rejected";
       return <tr key={d.id}>
        <td>{d.supplier_invoice_number}</td>
        <td>{doc?<a href={"/admin/workspaces/estates/expenses/documents/"+doc.id} target="_blank" rel="noopener noreferrer">Download origineel</a>:"Nog geen bestand"}</td>
        <td>{state==="draft"?"Concept":state==="submitted"?"In behandeling":state==="approved"?"Goedgekeurd":"Afgewezen"}</td>
        <td>{doc?<DraftReviewForm draft={d} state={state}/>:<span className={styles.hint}>Upload vereist</span>}</td>
       </tr>;
      })}</tbody>
    </table>
   </div>
   <p className={styles.hint}>Goedkeuring registreert alleen een intern beoordeelde kostenpost. Er wordt geen betaling uitgevoerd, geen klantfactuur gemaakt en geen e-mail verzonden. Afwijzingen blijven definitief zichtbaar; het corrigeren en opnieuw indienen vereist een aparte correctiefunctie.</p></>}
 </section>;
}
