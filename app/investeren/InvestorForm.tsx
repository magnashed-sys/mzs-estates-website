"use client";
import {useRef,useState} from "react";
import s from "./investeren.module.css";
export default function InvestorForm(){
 const [submitted,setSubmitted]=useState(false);
 const [videoPlatform,setVideoPlatform]=useState("");
 const [otherPlatform,setOtherPlatform]=useState("");
 const confirmation=useRef<HTMLDivElement>(null);
 return <div className={s.formPanel}>
  <p className={s.demoNote}>Voorbeeldformulier — gegevens worden niet opgeslagen of verzonden.</p>
  <div ref={confirmation} tabIndex={-1} role="status" aria-live="polite">
   {submitted&&<div className={s.success}><span aria-hidden="true">✓</span><h3>Zo ziet de bevestiging eruit.</h3><p>“Dank voor je belangstelling. We hebben je aanvraag ontvangen en nemen contact met je op om een kennismaking af te stemmen.”</p>{videoPlatform&&<p>Voorkeur voor de videocall: <strong>{videoPlatform==="Anders"?otherPlatform:videoPlatform}</strong></p>}<p><strong>Dit was een demonstratie.</strong> Er is geen aanvraag verstuurd.</p><button type="button" className={s.textLink} onClick={()=>{setSubmitted(false);setVideoPlatform("");setOtherPlatform("");}}>Formulier opnieuw bekijken ↗</button></div>}
  </div>
  {!submitted&&<form onSubmit={e=>{e.preventDefault();setSubmitted(true);requestAnimationFrame(()=>confirmation.current?.focus());}}>
   <h3>Plan een kennismaking</h3><p className={s.formIntro}>Vrijblijvend en persoonlijk. * Verplicht veld.</p>
   <label>Naam *<input name="name" autoComplete="name" placeholder="Je volledige naam" maxLength={150} required/></label>
   <label>E-mailadres *<input name="email" autoComplete="email" type="email" placeholder="naam@voorbeeld.nl" maxLength={254} required/></label>
   <label>Telefoonnummer <span>(optioneel)</span><input name="phone" autoComplete="tel" type="tel" placeholder="+31 of een andere landcode" maxLength={40}/></label>
   <div className={s.formRow}><label>Indicatie deelname<select name="amount" defaultValue=""><option value="" disabled>Selecteer een indicatie</option><option>€100.000 – €250.000</option><option>€250.000 – €500.000</option><option>€500.000 of meer</option><option>Eerst bespreken</option></select></label><label>Gewenste looptijd<select name="term" defaultValue=""><option value="" disabled>Selecteer een looptijd</option><option>1 jaar</option><option>2 jaar</option><option>3 jaar</option><option>Nog te bespreken</option></select></label></div>
   <label>Hoe wil je de videocall voeren? <span>(optioneel)</span><select name="videoPlatform" value={videoPlatform} onChange={e=>setVideoPlatform(e.target.value)}><option value="">Selecteer je voorkeur</option><option>Microsoft Teams</option><option>Zoom</option><option>WhatsApp-video</option><option>Google Meet</option><option>FaceTime</option><option>Geen voorkeur</option><option>Anders</option></select></label>
   {videoPlatform==="Anders"&&<label>Welk videoplatform heeft je voorkeur? *<input name="otherVideoPlatform" value={otherPlatform} onChange={e=>setOtherPlatform(e.target.value)} maxLength={100} placeholder="Naam van het videoplatform" required/></label>}
   {videoPlatform==="WhatsApp-video"&&<p className={s.formNote}>Vul hierboven bij voorkeur het telefoonnummer in waarop je WhatsApp gebruikt, inclusief landcode.</p>}
   <label>Wat wil je met ons bespreken? <span>(optioneel)</span><textarea name="message" rows={3} maxLength={2000} placeholder="Je vragen, voorkeuren of een korte introductie"/></label>
   <p className={s.formNote}>Een kennismaking is vrijblijvend en vormt geen toezegging tot deelname.</p>
   <button className={s.button} type="submit">Bekijk aanvraagbevestiging <span aria-hidden="true">↗</span></button>
   <p className={s.formNote}>In de definitieve versie: ‘Vraag een kennismaking aan’.</p>
  </form>}
 </div>;
}
