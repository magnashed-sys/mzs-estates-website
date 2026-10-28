"use server";
import {revalidatePath} from "next/cache";
import {requireOpsPilotStaff} from "../../../lib/security/property-ops-pilot";

export type PilotActionState={status:"idle"|"success"|"error";message:string};
const clean=(value:string,min:number,max:number)=>
 value.length>=min&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);
const date=/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function validDate(s:string){
 if(!date.test(s))return false;
 const d=new Date(s+"T00:00:00Z");
 return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;
}
/** Only synthetic pilot visits: cannot issue wages, bookings, invoices or payments. */
export async function recordPilotVisit(_prev:PilotActionState,form:FormData):Promise<PilotActionState>{
 const {db,assignment}=await requireOpsPilotStaff();
 const on=String(form.get("worked_on")??"");
 const minutes=Number(String(form.get("actual_minutes")??""));
 const description=String(form.get("description")??"").trim();
 if(form.get("confirmed_synthetic")!=="yes"||!validDate(on)||
   !Number.isSafeInteger(minutes)||minutes<1||minutes>960||!clean(description,8,1200))
   return {status:"error",message:"Gebruik uitsluitend synthetische testgegevens, een geldige datum en 1–960 minuten."};
 const {error}=await db.from("mzs_ops_pilot_visits").insert({
  run_id:assignment.run_id,property_id:assignment.property_id,
  worked_on:on,actual_minutes:minutes,description
 });
 if(error)return {status:"error",message:"Testbezoek niet opgeslagen. Controleer of je pilottoegang nog geldig is."};
 revalidatePath("/pilot/staff");
 return {status:"success",message:"Synthetisch bezoek opgeslagen in de afzonderlijke pilotadministratie. Geen factuur of betaling."};
}
/** A report is not an external vendor order or a charge to a customer. */
export async function recordPilotTicket(_prev:PilotActionState,form:FormData):Promise<PilotActionState>{
 const {db,assignment}=await requireOpsPilotStaff();
 const priority=String(form.get("priority")??"");
 const title=String(form.get("title")??"").trim();
 const description=String(form.get("description")??"").trim();
 if(form.get("confirmed_synthetic")!=="yes"||!["routine","soon","urgent"].includes(priority)||
   !clean(title,5,120)||!clean(description,8,1200))
   return {status:"error",message:"Gebruik uitsluitend synthetische testgegevens en geldige meldingsvelden."};
 const {error}=await db.from("mzs_ops_pilot_tickets").insert({
  run_id:assignment.run_id,property_id:assignment.property_id,
  priority,title,description
 });
 if(error)return {status:"error",message:"Testmelding niet opgeslagen. Controleer of je pilottoegang nog geldig is."};
 revalidatePath("/pilot/staff");
 return {status:"success",message:"Synthetische onderhoudsmelding geregistreerd. Geen werkopdracht of factuur verstuurd."};
}
