"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type RetentionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
const originAllowed=()=>process.env.VERCEL_ENV==="preview" &&
 process.env.NEXT_PUBLIC_SUPABASE_URL===staging;
const noControls=(text:string)=>/[\u0000-\u001f\u007f]/u.test(text);
const refresh=()=>revalidatePath("/admin/workspaces/estates/expenses");

/** Proposals are not approved legal policy and cannot start deletion jobs. */
export async function proposeEvidenceRetention(
 _prev:RetentionState,form:FormData
):Promise<RetentionState>{
 if(!originAllowed())return {status:"error",message:"Voorstellen zijn uitsluitend beschikbaar op de afgesloten Staging Preview."};
 if(form.get("confirmed_legal_review")!=="yes")
  return {status:"error",message:"Bevestig dat deze termijn uitsluitend ter controle wordt voorgesteld."};
 const {db}=await requireEstateAdmin();
 const legalEntityId=String(form.get("legal_entity_id")??"").trim();
 const jurisdiction=String(form.get("jurisdiction_code")??"").trim().toUpperCase();
 const years=Number(String(form.get("proposed_years")??""));
 const evidence=String(form.get("legal_source_reference")??"").trim();
 if(!uuid.test(legalEntityId)||!/[A-Z]{2}/.test(jurisdiction)||jurisdiction.length!==2||
   !Number.isSafeInteger(years)||years<1||years>30||
   evidence.length<12||evidence.length>1000||noControls(evidence))
  return {status:"error",message:"Controleer juridische entiteit, landcode, voorgestelde jaren en verificatiebron."};
 const {data:entity,error:entityError}=await db.from("mzs_lease_issuers")
  .select("id").eq("id",legalEntityId).maybeSingle();
 if(entityError||!entity)return {status:"error",message:"Juridische entiteit niet gevonden. Niets geregistreerd."};
 const {error}=await db.from("mzs_ops_expense_retention_proposals").insert({
  legal_entity_id:legalEntityId,jurisdiction_code:jurisdiction,
  proposed_years:years,legal_source_reference:evidence
 });
 if(error?.code==="23505")return {status:"error",message:"Er is al een voorgesteld beleid voor deze entiteit en dit land."};
 if(error)return {status:"error",message:"Het voorstel is niet opgeslagen. Controleer de rechten en de bron."};
 refresh();
 return {status:"success",message:"Niet-bindend voorstel in controlehistorie vastgelegd. Geen bewaartermijn geactiveerd en niets verwijderd."};
}

/** Additional legal hold, irrevocable at this stage, never a delete action. */
export async function placeEvidenceHold(
 _prev:RetentionState,form:FormData
):Promise<RetentionState>{
 if(!originAllowed())return {status:"error",message:"Legal holds zijn uitsluitend op geïsoleerde Staging beschikbaar."};
 if(form.get("confirmed_hold")!=="yes")
  return {status:"error",message:"Bevestig dat de bewijsstukken niet verwijderd mogen worden."};
 const {db}=await requireEstateAdmin();
 const documentId=String(form.get("document_id")??"").trim();
 const reason=String(form.get("hold_reason")??"").trim();
 if(!uuid.test(documentId)||reason.length<12||reason.length>1000||noControls(reason))
  return {status:"error",message:"Selecteer het geregistreerde document en een onderbouwde bewaarreden."};
 const {data:document,error:documentError}=await db.from("mzs_ops_expense_documents")
  .select("id").eq("id",documentId).maybeSingle();
 if(documentError||!document)return {status:"error",message:"Document niet beschikbaar. Er is niets veranderd."};
 const {error}=await db.from("mzs_ops_expense_document_holds").insert({
  document_id:documentId,hold_reason:reason
 });
 if(error?.code==="23505")return {status:"error",message:"Dit document staat al onder legal hold."};
 if(error)return {status:"error",message:"De bewaarblokkade kon niet worden vastgelegd."};
 refresh();
 return {status:"success",message:"Legal hold onveranderbaar vastgelegd. Er is geen verwijderfunctie geactiveerd."};
}
