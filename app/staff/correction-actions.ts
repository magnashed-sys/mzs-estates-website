"use server";
import {revalidatePath} from "next/cache";
import {requirePropertyStaff} from "../../lib/security/property-staff";
export type CorrectionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Original work log remains immutable. Corrections require administrator decision. */
export async function requestVisitCorrection(_prev:CorrectionState,form:FormData):Promise<CorrectionState>{
 const {db}=await requirePropertyStaff();
 const visitId=String(form.get("visit_id")??"");
 const minutes=Number(String(form.get("proposed_minutes")??""));
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(visitId)||!Number.isSafeInteger(minutes)||minutes<1||minutes>960||
  reason.length<10||reason.length>1000||/[\u0000-\u001f\u007f]/u.test(reason))
   return {status:"error",message:"Controleer bezoek, voorgestelde minuten en onderbouwing."};
 const {error}=await db.from("mzs_ops_visit_correction_requests").insert({
  visit_id:visitId,proposed_minutes:minutes,reason
 });
 if(error)return {status:"error",message:"Correctievoorstel niet opgeslagen. Alleen onbeoordeelde eigen bezoeken komen in aanmerking."};
 revalidatePath("/staff");
 return {status:"success",message:"Correctievoorstel ingediend. Je oorspronkelijke uren blijven staan totdat de beheerder het heeft beoordeeld."};
}
