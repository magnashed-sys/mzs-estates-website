"use client";
import {useActionState,useState} from "react";
import {useRouter} from "next/navigation";
import {requestVisitCorrection,initialCorrectionState} from "./correction-actions";
import s from "./staff.module.css";

type Visit={id:string;worked_on:string;actual_minutes:number;property_id:string};
type Ticket={id:string;title:string};
type Correction={id:string;visit_id:string;proposed_minutes:number;reason:string};
type Photo={id:string;ticket_id:string};

function CorrectionRequest({visit}:{visit:Visit}){
 const [state,action,pending]=useActionState(requestVisitCorrection,initialCorrectionState);
 return <form className={s.form} action={action}>
  <h2>Uren corrigeren</h2>
  <p className={s.description}>Bezoek {visit.worked_on}: origineel {visit.actual_minutes} minuten. Dit wordt niet overschreven.</p>
  <input type="hidden" name="visit_id" value={visit.id}/>
  <label>Voorgestelde juiste minuten<input type="number" name="proposed_minutes" required
   min={1} max={960} step={1}/></label>
  <label>Waarom corrigeren?<textarea name="reason" required minLength={10} maxLength={1000} rows={3}/></label>
  <button type="submit" disabled={pending}>{pending?"Registreren…":"Correctie ter beoordeling indienen"}</button>
  {state.message&&<p className={state.status==="error"?s.error:s.confirm} role="status">{state.message}</p>}
 </form>;
}
function PhotoUploader({tickets,photos}:{tickets:Ticket[];photos:Photo[]}){
 const [ticketId,setTicketId]=useState("");
 const [file,setFile]=useState<File|null>(null);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const router=useRouter();
 const used=photos.filter(x=>x.ticket_id===ticketId).length;
 const save=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(!ticketId||!file||used>=3||busy)return;
  setBusy(true);setMessage("");
  try{
   const form=new FormData();form.set("ticket_id",ticketId);form.set("file",file);
   const response=await fetch("/api/staff/maintenance-photo",{
    method:"POST",body:form,credentials:"same-origin",cache:"no-store"
   });
   const data=await response.json() as {message?:string;ok?:boolean};
   if(!response.ok||!data.ok)throw new Error(data.message??"Foto niet opgeslagen");
   setFile(null);setMessage("Foto beveiligd opgeslagen. Het origineel blijft bij de melding.");
   router.refresh();
  }catch(err){setMessage(err instanceof Error?err.message:"Upload niet gelukt");}
  finally{setBusy(false);}
 };
 return <form className={s.form} onSubmit={save}>
  <h2>Foto bij onderhoudsmelding</h2>
  <p className={s.description}>Privé, maximaal drie beelden per eigen melding. Foto's mogen geen persoonsgegevens of vertrouwelijke documenten tonen.</p>
  <label>Mijn onderhoudsmelding<select value={ticketId} onChange={e=>{setTicketId(e.target.value);setFile(null);}} required>
   <option value="">Selecteer een melding</option>
   {tickets.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
  </select></label>
  {ticketId&&<p className={s.description}>{used} van 3 foto's gekoppeld.
   {photos.filter(p=>p.ticket_id===ticketId).map(p=><span key={p.id}> · <a href={"/api/staff/maintenance-photo/"+p.id} target="_blank" rel="noopener noreferrer">Open foto</a></span>)}
  </p>}
  <label>Originele foto (JPEG, PNG of WebP, max. 4 MB)
   <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/>
  </label>
  <button type="submit" disabled={!ticketId||!file||used>=3||busy}>{busy?"Uploaden…":"Foto veilig toevoegen"}</button>
  {message&&<p role="status" className={s.description}>{message}</p>}
 </form>;
}
export default function StaffCompletion({visits,tickets,corrections,photos}:{
 visits:Visit[];tickets:Ticket[];corrections:Correction[];
 photos:Photo[]
}){
 const revised=new Set(corrections.map(x=>x.visit_id));
 const candidates=visits.filter(v=>!revised.has(v.id));
 const [chosen,setChosen]=useState("");
 const selected=candidates.find(x=>x.id===chosen);
 return <section className={s.history} aria-label="Aanvullende medewerkerstaken">
  <div>
   <h2>Mijn urencorrecties</h2>
   <p className={s.description}>Correcties worden uitsluitend voor nog onbeoordeelde bezoeken geaccepteerd. De beheerder beslist afzonderlijk; het systeem weigert al beoordeelde bezoeken.</p>
   {corrections.length>0&&<p className={s.description}>{corrections.length} correctievoorstel(len) in je historie.</p>}
   {candidates.length===0?<p className={s.description}>Geen onbeoordeelde bezoeken om te corrigeren.</p>:
    <>
     <label className={s.description}>Kies bezoek
      <select value={chosen} onChange={e=>setChosen(e.target.value)}>
       <option value="">Selecteer eigen bezoek</option>
       {candidates.map(v=><option value={v.id} key={v.id}>{v.worked_on} · {v.actual_minutes} minuten</option>)}
      </select>
     </label>
     {selected&&<CorrectionRequest key={selected.id} visit={selected}/>}
    </>}
  </div>
  <PhotoUploader tickets={tickets} photos={photos}/>
 </section>;
}
