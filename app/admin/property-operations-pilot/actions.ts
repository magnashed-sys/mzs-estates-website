"use server";
import {revalidatePath} from "next/cache";
import {requireOpsPilotAdmin} from "../../../lib/security/property-ops-pilot";
export type PilotAdminState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valid=(s:string,min:number,max:number)=>
 s.length>=min&&s.length<=max&&!/[\u0000-\u001f\u007f]/u.test(s);
const path="/admin/property-operations-pilot";
/** New runs are disabled until a separate explicit administrator activation event. */
export async function createPilotRun(_prev:PilotAdminState,form:FormData):Promise<PilotAdminState>{
 const {db}=await requireOpsPilotAdmin();
 const propertyId=String(form.get("property_id")??"");
 const purpose=String(form.get("purpose")??"").trim();
 if(form.get("confirmed_synthetic")!=="yes"||!uuid.test(propertyId)||!valid(purpose,12,300))
  return {status:"error",message:"Controleer het object, het uitsluitend synthetische doel en de bevestiging."};
 const {error}=await db.from("mzs_ops_pilot_runs").insert({property_id:propertyId,purpose});
 if(error)return {status:"error",message:"Pilotrun niet aangemaakt. Er is niets geactiveerd."};
 revalidatePath(path);
 return {status:"success",message:"Nieuwe pilotrun gemaakt, standaard UIT. Er is nog geen medewerker toegang verleend."};
}
/** Terminal deactivation is the first emergency stop; never toggles Production features. */
export async function changePilotRunState(_prev:PilotAdminState,form:FormData):Promise<PilotAdminState>{
 const {db}=await requireOpsPilotAdmin();
 const runId=String(form.get("run_id")??"");
 const action=String(form.get("action")??"");
 const reason=String(form.get("reason")??"").trim();
 if(form.get("confirmed_stage")!=="yes"||!uuid.test(runId)||
  !["activate","deactivate"].includes(action)||!valid(reason,10,500))
  return {status:"error",message:"Selecteer de pilotrun en de gewenste actie, vul een reden in en bevestig expliciet."};
 const {data:run,error:runError}=await db.from("mzs_ops_pilot_runs")
  .select("id").eq("id",runId).maybeSingle();
 if(runError||!run)
  return {status:"error",message:"Deze pilotrun is niet beschikbaar. Ververs de pagina en controleer de selectie."};
 const {data:latest,error:latestError}=await db.from("mzs_ops_pilot_run_events")
  .select("action").eq("run_id",runId).order("sequence_no",{ascending:false})
  .limit(1).maybeSingle();
 if(latestError)
  return {status:"error",message:"De actuele status kon niet veilig worden gecontroleerd. Er is niets gewijzigd."};
 if(action==="activate"&&latest?.action==="activate")
  return {status:"error",message:"Deze pilotrun is al actief. Je kunt nu bij stap 3 een medewerker toewijzen."};
 if(action==="activate"&&latest?.action==="deactivate")
  return {status:"error",message:"Deze pilotrun is definitief gestopt en kan niet opnieuw worden gestart. Maak zo nodig een nieuwe run."};
 if(action==="deactivate"&&latest?.action!=="activate")
  return {status:"error",message:"Deze run is niet actief. Een run die nog UIT staat hoeft niet gestopt te worden."};
 const {error}=await db.from("mzs_ops_pilot_run_events").insert({run_id:runId,action,reason});
 if(error){
  if(error.message.includes("Another pilot is active for this property"))
   return {status:"error",message:"Er is al een actieve pilot voor dit object. Stop die pilot eerst definitief."};
  return {status:"error",message:"De pilotstatus is niet gewijzigd. Controleer of de run nog de verwachte status heeft."};
 }
 revalidatePath(path);
 return {status:"success",message:action==="deactivate"?
  "PILOT GESTOPT: terminale blokkade voor alle medewerkers. Historie blijft bewaard.":
  "Pilotrun geactiveerd. Ga nu naar stap 3 om één bestaande medewerker expliciet toegang te geven."};
}
/** One current synthetic pilot worker per run, no existing client role mutation. */
export async function changePilotWorkerScope(_prev:PilotAdminState,form:FormData):Promise<PilotAdminState>{
 const {db}=await requireOpsPilotAdmin();
 const runId=String(form.get("run_id")??"");
 const profileId=String(form.get("profile_id")??"");
 const action=String(form.get("action")??"");
 const reason=String(form.get("reason")??"").trim();
 if(form.get("confirmed_stage")!=="yes"||!uuid.test(runId)||!uuid.test(profileId)||
  !["grant","revoke"].includes(action)||!valid(reason,10,500))
  return {status:"error",message:"Selecteer een pilotrun, bestaande relatie en handeling. Vul de reden in en bevestig expliciet."};

 // Explain failed prerequisites without bypassing live RLS, insert triggers or admin authorization.
 const {data:run,error:runError}=await db.from("mzs_ops_pilot_runs")
  .select("id").eq("id",runId).maybeSingle();
 if(runError||!run)
  return {status:"error",message:"De gekozen pilotrun bestaat niet meer of is niet toegankelijk. Ververs de pagina."};
 const {data:latestRun,error:statusError}=await db.from("mzs_ops_pilot_run_events")
  .select("action").eq("run_id",runId).order("sequence_no",{ascending:false})
  .limit(1).maybeSingle();
 if(statusError)
  return {status:"error",message:"De pilotstatus is niet beschikbaar. Er zijn geen rechten aangepast."};
 if(action==="grant"&&latestRun?.action!=="activate")
  return {status:"error",message:latestRun?.action==="deactivate"?
   "Deze pilotrun is definitief gestopt. Maak eerst een nieuwe run aan; opnieuw activeren is niet toegestaan.":
   "Deze pilotrun staat nog UIT. Ga eerst naar stap 2, kies 'Expliciet activeren' en probeer daarna opnieuw."};

 const {data:profile,error:profileError}=await db.from("profiles")
  .select("id,role,is_active").eq("id",profileId).maybeSingle();
 if(profileError)
  return {status:"error",message:"De bestaande relatie kon niet worden gecontroleerd. Er zijn geen rechten gewijzigd."};
 if(action==="grant"&&(!profile||!profile.is_active||
     !["client","partner"].includes(String(profile.role))))
  return {status:"error",message:"Dit account is niet actief of heeft geen geschikte cliënt-/partnerrol. Controleer de bestaande relatie."};

 const {data:latestScope,error:scopeError}=await db.from("mzs_ops_pilot_access_events")
  .select("action").eq("run_id",runId).eq("profile_id",profileId)
  .order("sequence_no",{ascending:false}).limit(1).maybeSingle();
 if(scopeError)
  return {status:"error",message:"De actuele toewijzing kon niet worden gecontroleerd. Er zijn geen rechten gewijzigd."};
 if(action==="revoke"&&latestScope?.action!=="grant")
  return {status:"error",message:"Dit account heeft geen bestaande toewijzing voor deze pilot. Kies 'Toegang geven voor deze pilot' als je iemand wilt toevoegen."};
 if(action==="grant"&&latestScope?.action==="grant")
  return {status:"error",message:"Dit account is al aan deze pilot toegewezen. Je hoeft de toegang niet opnieuw te registreren."};

 const {error}=await db.from("mzs_ops_pilot_access_events").insert({
  run_id:runId,profile_id:profileId,action,reason
 });
 if(error){
  if(error.message.includes("Only one current pilot worker per run"))
   return {status:"error",message:"Aan deze pilot is al een andere medewerker gekoppeld. Trek eerst diens toegang in (maximaal één tegelijk)."};
  if(error.message.includes("Enabled run and active client/partner required"))
   return {status:"error",message:"De pilot is niet actief of de relatie is niet meer geldig. Controleer stap 2 en het account."};
  if(error.message.includes("Pilot scope already has this state"))
   return {status:"error",message:"De toegang heeft inmiddels al deze status. Ververs de pagina om de laatste wijzigingen te bekijken."};
  return {status:"error",message:"Toegang niet gewijzigd. Ververs de pagina en controleer de actuele pilotstatus en medewerkerstoewijzingen."};
 }
 revalidatePath(path);
 return {status:"success",message:action==="revoke"?
  "Medewerkerstoegang ingetrokken; bestaande sessies verliezen ook lees- en schrijfrechten.":
  "Medewerker toegevoegd voor alleen deze ene actieve pilotrun, zonder wijziging van accountrol."};
}
