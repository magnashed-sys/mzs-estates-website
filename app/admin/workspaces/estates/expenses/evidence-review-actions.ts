"use server";

import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type ReviewActionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An explicit reviewed action; no direct changes to the cost original. */
export async function changeExpenseReview(
 _prev:ReviewActionState,form:FormData
):Promise<ReviewActionState>{
 if(process.env.VERCEL_ENV!=="preview"||
    process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
   return {status:"error",message:"Deze handeling is alleen beschikbaar op MZS Staging."};
 const {db}=await requireEstateAdmin();
 const id=String(form.get("draft_id")??"");
 const expected=String(form.get("expected_state")??"");
 const action=String(form.get("review_action")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(id)||!["draft","submitted"].includes(expected)||
    !["submitted","approved","rejected"].includes(action) ||
    (expected==="draft"&&action!=="submitted")||
    (expected==="submitted"&&action==="submitted") ||
    reason.length>1000||(action==="rejected"&&reason.length<8)) {
   return {status:"error",message:"Ongeldige controlehandeling of ontbrekende reden."};
 }
 // The database trigger obtains an exclusive draft lock, validates evidence
 // and rejects stale/unauthorised transitions; client state is never trusted.
 const {error}=await db.from("mzs_ops_expense_review_events").insert({
  draft_id:id,action,expected_state:expected,reason
 });
 if(error)return {status:"error",message:"Controle niet vastgelegd. Herlaad het dossier en controleer of het originele document aanwezig is."};
 revalidatePath("/admin/workspaces/estates/expenses");
 return {status:"success",message:action==="approved"?
  "Kostenconcept administratief goedgekeurd. Er is niets betaald of aan een klant gefactureerd.":
  action==="rejected"?"Het concept is afgewezen en blijft met reden in de historie.":
  "Kostenconcept is ter beoordeling ingediend."};
}
