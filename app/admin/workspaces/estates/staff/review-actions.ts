"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type StaffReviewState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
function validReason(s:string,min=8,max=1000){
 return s.length>=min&&s.length<=max&&!/[\u0000-\u001f\u007f]/u.test(s);
}
function intOrNull(v:FormDataEntryValue|null){
 const s=String(v??"");
 if(s==="")return null;
 if(!/^\d{1,4}$/.test(s))throw Error("Invalid integer");
 const value=Number(s);
 if(!Number.isSafeInteger(value)||value>2000)throw Error("Integer outside range");
 return value;
}
export async function reviewActualVisit(_prev:StaffReviewState,form:FormData):Promise<StaffReviewState>{
 if(process.env.VERCEL_ENV!=="preview"||process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)
  return {status:"error",message:"Urencontrole is alleen op MZS Staging toegestaan."};
 const {db}=await requireEstateAdmin();
 const id=String(form.get("visit_id")??"");
 const decision=String(form.get("decision")??"");
 const recharge=String(form.get("recharge_class")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||!["approved","rejected"].includes(decision)||
   !["not_billable","review_candidate"].includes(recharge)||!validReason(reason)||
   (decision==="rejected"&&recharge!=="not_billable"))
  return {status:"error",message:"Controleer beslissing, onderbouwing en factureerbaarheid."};
 let minimum:number|null,increment:number|null;
 try{minimum=intOrNull(form.get("minimum_minutes"));increment=intOrNull(form.get("increment_minutes"));}
 catch{return {status:"error",message:"Controleer de afrondingsregel in hele minuten."};}
 if(recharge==="review_candidate"&&(minimum===null||increment===null||minimum>960||increment<1||increment>960)||
    recharge==="not_billable"&&(minimum!==null||increment!==null))
  return {status:"error",message:"Gebruik alleen een expliciet geverifieerde factureerregel bij kandidaat-doorbelasting."};
 const {error}=await db.from("mzs_ops_visit_reviews").insert({
  visit_id:id,decision,reason,recharge_class:recharge,
  minimum_minutes:minimum,increment_minutes:increment
 });
 if(error)return {status:"error",message:"Beoordeling niet verwerkt. Dit bezoek is mogelijk al beoordeeld of het dossier is niet beschikbaar."};
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:recharge==="review_candidate"?
  "Bezoek beoordeeld. De afzonderlijke factureerbare minuten zijn uitsluitend een voorstel, geen factuur.":
  "Bezoek beoordeeld en zonder doorbelasting vastgelegd. De oorspronkelijke tijd blijft ongewijzigd."};
}
export async function recordTicketProgress(_prev:StaffReviewState,form:FormData):Promise<StaffReviewState>{
 if(process.env.VERCEL_ENV!=="preview"||process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)
  return {status:"error",message:"Onderhoudsbeheer is alleen op Staging toegestaan."};
 const {db}=await requireEstateAdmin();
 const ticketId=String(form.get("ticket_id")??"");
 const action=String(form.get("action")??"");
 const note=String(form.get("note")??"").trim();
 const workRef=String(form.get("work_order_reference")??"").trim();
 if(!uuid.test(ticketId)||!["triaged","scheduled","in_progress","resolved","reopened","closed"].includes(action)||
    !validReason(note,8,2000)||(workRef.length>0&&!validReason(workRef,3,100)))
  return {status:"error",message:"Controleer melding, nieuwe status en onderbouwing."};
 const {error}=await db.from("mzs_ops_maintenance_events").insert({
  ticket_id:ticketId,action,note,work_order_reference:workRef||null
 });
 if(error)return {status:"error",message:"De statuswijziging is niet geregistreerd. Controleer de meest recente meldingsstatus."};
 revalidatePath("/admin/workspaces/estates/staff");
 revalidatePath("/staff");
 return {status:"success",message:"Onderhoudsstatus met controlehistorie bijgewerkt. Er is geen externe werkopdracht of factuur verstuurd."};
}
