"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type OpsActionState={status:"idle"|"success"|"error";message:string};
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function amount(raw:FormDataEntryValue|null){
 const s=String(raw??"");
 if(!/^\d{1,12}$/.test(s))return null;
 const n=Number(s);
 return Number.isSafeInteger(n)&&n<=100000000000?n:null;
}
function validReason(s:string,min:number,max:number){
 return s.length>=min&&s.length<=max&&!/[\u0000-\u001f\u007f]/u.test(s);
}
function guarded(){return process.env.VERCEL_ENV==="preview"&&process.env.NEXT_PUBLIC_SUPABASE_URL===staging;}
/** Approval never overwrites worker's source minutes or issues a customer invoice. */
export async function decideStaffCorrection(_previous:OpsActionState,form:FormData):Promise<OpsActionState>{
 if(!guarded())return {status:"error",message:"Alleen Staging."};
 const {db}=await requireEstateAdmin();
 const id=String(form.get("correction_id")??"");
 const decision=String(form.get("decision")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||!["approved","rejected"].includes(decision)||!validReason(reason,8,1000))
  return {status:"error",message:"Selecteer een geldig correctievoorstel en voeg een reden toe."};
 const {error}=await db.from("mzs_ops_visit_correction_decisions").insert({correction_id:id,decision,reason});
 if(error)return {status:"error",message:"Beslissing geweigerd. Controleer of dit bezoek nog niet beoordeeld is."};
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:"Correctie beoordeeld. De oorspronkelijke werktijd en audit blijven behouden; factureerbare tijd wordt pas apart vastgesteld."};
}
export async function createInternalWorkOrder(_previous:OpsActionState,form:FormData):Promise<OpsActionState>{
 if(!guarded())return {status:"error",message:"Alleen Staging."};
 const {db}=await requireEstateAdmin();
 const ticketId=String(form.get("ticket_id")??"");
 const issuer=String(form.get("legal_entity_id")??"");
 const supplier=String(form.get("supplier_relationship_id")??"");
 const scope=String(form.get("scope_of_work")??"").trim();
 const quote=String(form.get("quotation_reference")??"").trim();
 const net=amount(form.get("approved_budget_net_cents"));
 const vat=amount(form.get("approved_budget_vat_cents"));
 if(![ticketId,issuer,supplier].every(x=>uuid.test(x))||
  !validReason(scope,10,2000)||!validReason(quote,3,180)||
  net===null||vat===null||net+vat<=0)
  return {status:"error",message:"Controleer het onderhoudsdossier, de entiteit, leverancier, offerte en budget."};
 const {error}=await db.from("mzs_ops_maintenance_work_orders").insert({
  ticket_id:ticketId,legal_entity_id:issuer,supplier_relationship_id:supplier,
  scope_of_work:scope,quotation_reference:quote,
  approved_budget_net_cents:net,approved_budget_vat_cents:vat
 });
 if(error)return {status:"error",message:"Interne conceptwerkopdracht geweigerd: controleer onderhoudsstatus en geverifieerde kostendrager."};
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:"Interne werkopdracht als concept vastgelegd. Er is geen leverancier geïnformeerd of verplichting aangegaan."};
}
export async function decideInternalWorkOrder(_previous:OpsActionState,form:FormData):Promise<OpsActionState>{
 if(!guarded())return {status:"error",message:"Alleen Staging."};
 const {db}=await requireEstateAdmin();
 const id=String(form.get("work_order_id")??"");
 const decision=String(form.get("decision")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||!["authorized_internally","declined"].includes(decision)||!validReason(reason,8,1000))
  return {status:"error",message:"Selecteer een geldige werkopdracht, beslissing en onderbouwing."};
 const {error}=await db.from("mzs_ops_maintenance_work_order_decisions").insert({
  work_order_id:id,decision,reason
 });
 if(error)return {status:"error",message:"Beslissing niet vastgelegd. Deze werkopdracht kan al beoordeeld zijn."};
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:decision==="authorized_internally"?
  "Budget intern geautoriseerd; er is geen externe opdracht, betaling of factuur verstuurd.":
  "Conceptwerkopdracht afgewezen; het oorspronkelijke dossier blijft beschikbaar."};
}
