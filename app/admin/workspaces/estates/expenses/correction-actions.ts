"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type CostCorrectionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function intCents(value:FormDataEntryValue|null):number|null{
 const s=String(value??"");
 if(!/^\d{1,12}$/.test(s))return null;
 const n=Number(s);
 return Number.isSafeInteger(n)&&n>=0&&n<=100000000000?n:null;
}
/** A proposal is not an amendment or payment; original remains immutable. */
export async function proposeSupplierCostCorrection(_previous:CostCorrectionState,form:FormData):Promise<CostCorrectionState>{
 if(process.env.VERCEL_ENV!=="preview"||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
   return {status:"error",message:"Correctievoorstellen zijn alleen beschikbaar op MZS Staging."};
 const {db}=await requireEstateAdmin();
 const id=String(form.get("draft_id")??"");
 const reason=String(form.get("reason")??"").trim();
 const description=String(form.get("description")??"").trim();
 const net=intCents(form.get("net_cents")),vat=intCents(form.get("vat_cents"));
 const allocationsText=String(form.get("allocations")??"");
 if(!uuid.test(id)||reason.length<10||reason.length>1000||
    description.length<2||description.length>500||/[\r\n\x00-\x1f]/.test(description)||
    net===null||vat===null||net+vat<=0||allocationsText.length<2||allocationsText.length>15000)
  return {status:"error",message:"Controleer correctiereden, omschrijving en bedragen."};
 let allocations:unknown;
 try{
  allocations=JSON.parse(allocationsText);
  if(!Array.isArray(allocations)||allocations.length<1||allocations.length>100)
   throw Error("Invalid proposed allocation");
 }catch{return {status:"error",message:"De voorgestelde unitverdeling is ongeldig."};}
 // A database trigger holds a draft row lock, checks completed review status,
 // effective unit ownership and exact cent reconciliation.
 const {error}=await db.from("mzs_ops_expense_correction_requests").insert({
   draft_id:id,reason,proposed_description:description,
   proposed_net_cents:net,proposed_vat_cents:vat,proposed_allocations:allocations
 });
 if(error?.code==="23505")return {status:"error",message:"Er bestaat al een correctievoorstel voor dit kostenconcept."};
 if(error)return {status:"error",message:"Correctievoorstel niet geregistreerd. Controleer de reviewstatus en de unitverdeling."};
 revalidatePath("/admin/workspaces/estates/expenses");
 return {status:"success",message:"Correctievoorstel geregistreerd. Het oorspronkelijke document en de goedkeuring blijven ongewijzigd; dit is nog geen nieuwe kostenboeking."};
}
