"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type CorrectionDecisionState={status:"idle"|"success"|"error";message:string};
export const initialCorrectionDecision:CorrectionDecisionState={status:"idle",message:""};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Does not post corrected amounts or change the original invoice/document. */
export async function decideCorrection(
 _previous:CorrectionDecisionState,form:FormData
):Promise<CorrectionDecisionState>{
 if(process.env.VERCEL_ENV!=="preview"||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
  return {status:"error",message:"Beslissingen zijn alleen op MZS Staging mogelijk."};
 const {db}=await requireEstateAdmin();
 const id=String(form.get("correction_id")??"");
 const decision=String(form.get("decision")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||!["declined","replacement_required"].includes(decision)||
   reason.length<8||reason.length>1000||/[\u0000-\u001f\u007f]/u.test(reason))
  return {status:"error",message:"Vul een geldige beslissing en onderbouwing in."};
 const {error}=await db.from("mzs_ops_expense_correction_decisions").insert({
   correction_id:id,decision,reason
 });
 if(error?.code==="23505")return {status:"error",message:"Dit correctievoorstel is al afgehandeld."};
 if(error)return {status:"error",message:"De beslissing kon niet worden geregistreerd. Controleer status en toegang."};
 revalidatePath("/admin/workspaces/estates/expenses");
 return {status:"success",message:decision==="declined"?
  "Correctie afgewezen; de oorspronkelijke beoordeling blijft geldig als deze eerder goedgekeurd was.":
  "Vervangingsdocument vereist. Het oorspronkelijke bedrag blijft uitgesloten van de goedgekeurde proefexport."};
}
