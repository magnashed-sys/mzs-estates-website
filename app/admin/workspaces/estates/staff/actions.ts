"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type ScopeActionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Group Admin grants/revokes one property at a time, with immutable provenance. */
export async function recordStaffScope(_prev:ScopeActionState,form:FormData):Promise<ScopeActionState>{
 if(process.env.VERCEL_ENV!=="preview"||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
  return {status:"error",message:"Toegangsbeheer is alleen in de Staging Preview mogelijk."};
 const {db}=await requireEstateAdmin();
 const profileId=String(form.get("profile_id")??"");
 const propertyId=String(form.get("property_id")??"");
 const action=String(form.get("scope_action")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(profileId)||!uuid.test(propertyId)||!["grant","revoke"].includes(action)||
   reason.length<8||reason.length>500||/[\u0000-\u001f\u007f]/u.test(reason))
  return {status:"error",message:"Selecteer een bestaande relatie, object, handeling en onderbouwing."};
 const [user,property]=await Promise.all([
  db.from("profiles").select("id,role,is_active").eq("id",profileId).maybeSingle(),
  db.from("mzs_estate_properties").select("id").eq("id",propertyId).maybeSingle()
 ]);
 if(user.error||!user.data||!user.data.is_active||
    !["client","partner"].includes(user.data.role)||
    property.error||!property.data)
  return {status:"error",message:"Actief account of object niet gevonden. Er is niets opgeslagen."};
 const {error}=await db.from("mzs_ops_staff_scope_events").insert({
   profile_id:profileId,property_id:propertyId,action,reason
 });
 if(error)return {status:"error",message:"De toewijzing kon niet worden verwerkt. Controleer de vorige toegangstoestand."};
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:action==="grant"?
  "Medewerker heeft op Staging nu toegang tot dit specifieke object. Geen andere dossierrechten gewijzigd.":
  "Objecttoegang is ingetrokken en met reden vastgelegd."};
}
