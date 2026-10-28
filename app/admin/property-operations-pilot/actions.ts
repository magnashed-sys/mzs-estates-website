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
  return {status:"error",message:"Controleer run, actie, reden en expliciete bevestiging."};
 const {error}=await db.from("mzs_ops_pilot_run_events").insert({run_id:runId,action,reason});
 if(error)return {status:"error",message:"Statuswijziging geweigerd. De run kan al gestopt zijn of een andere run actief zijn."};
 revalidatePath(path);
 return {status:"success",message:action==="deactivate"?
  "PILOT GESTOPT: terminale blokkade voor alle medewerkers. Historie blijft bewaard.":
  "Pilotrun geactiveerd, maar nog niemand heeft toegang zonder afzonderlijke objecttoewijzing."};
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
  return {status:"error",message:"Controleer de bestaande relatie, run, handeling, reden en bevestiging."};
 const {error}=await db.from("mzs_ops_pilot_access_events").insert({
  run_id:runId,profile_id:profileId,action,reason
 });
 if(error)return {status:"error",message:"Toegang niet aangepast. Maximaal één actuele medewerker per actieve run."};
 revalidatePath(path);
 return {status:"success",message:action==="revoke"?
  "Medewerkerstoegang ingetrokken; bestaande sessies verliezen ook lees- en schrijfrechten.":
  "Medewerker toegevoegd voor alleen deze ene actieve pilotrun, zonder wijziging van accountrol."};
}
