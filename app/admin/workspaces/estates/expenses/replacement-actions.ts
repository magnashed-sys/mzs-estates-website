"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
export type ReplacementState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Link two existing immutable, separately approved supplier originals.
 * This NEVER issues another customer invoice or posts an amount.
 */
export async function linkSupplierReplacement(_prev:ReplacementState,data:FormData):Promise<ReplacementState>{
 if(process.env.VERCEL_ENV!=="preview"||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
   return {status:"error",message:"Koppelen is alleen op MZS Staging mogelijk."};
 if(data.get("confirmed_immutable_correction")!=="yes")
   return {status:"error",message:"Bevestig eerst de onveranderbare, fictieve Staging-correctie."};
 const {db}=await requireEstateAdmin();
 const correctionId=String(data.get("correction_id")??"");
 const newDraft=String(data.get("replacement_draft_id")??"");
 const verification=String(data.get("verification_note")??"").trim();
 if(!uuid.test(correctionId)||!uuid.test(newDraft)||
   verification.length<12||verification.length>1000||/[\u0000-\u001f\u007f]/u.test(verification))
   return {status:"error",message:"Selecteer het correctieverzoek, een nieuwe factuur en geef de verificatiebron op."};
 // The trigger holds both original and new draft locks and verifies admin, exact
 // property/issuer/supplier match, prior approval, new source and one-to-one link.
 const {error}=await db.from("mzs_ops_expense_replacements").insert({
   correction_id:correctionId,replacement_draft_id:newDraft,verification_note:verification
 });
 if(error?.code==="23505")return {status:"error",message:"Er bestaat al een vervangingskoppeling."};
 if(error)return {status:"error",message:"Koppeling niet opgeslagen. Controleer goedkeuring, nieuw origineel, leverancier en entiteit."};
 revalidatePath("/admin/workspaces/estates/expenses");
 return {status:"success",message:"De vervangende, afzonderlijk goedgekeurde inkoopfactuur is als nieuw dossier gekoppeld. Er zijn geen betalingen of klantfacturen aangemaakt."};
}
