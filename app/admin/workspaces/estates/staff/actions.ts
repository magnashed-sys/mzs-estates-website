"use server";
import {requireStaffEnvironment} from "../../../../../lib/security/property-staff";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type ScopeActionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Group Admin grants/revokes one property at a time, with immutable provenance. */
export async function recordStaffScope(_prev:ScopeActionState,form:FormData):Promise<ScopeActionState>{
 await requireStaffEnvironment();
 const {db}=await requireEstateAdmin();
 const profileId=String(form.get("profile_id")??"");
 const propertyId=String(form.get("property_id")??"");
 const action=String(form.get("scope_action")??"");
 const reason=String(form.get("reason")??"").trim();
 if(!uuid.test(profileId)||!uuid.test(propertyId)||!["grant","revoke"].includes(action)||
   reason.length<8||reason.length>500||/[\u0000-\u001f\u007f]/u.test(reason))
  return {status:"error",message:"Select an existing relationship, property, action and supporting reason."};
 const [user,property]=await Promise.all([
  db.from("profiles").select("id,role,is_active").eq("id",profileId).maybeSingle(),
  db.from("mzs_estate_properties").select("id").eq("id",propertyId).maybeSingle()
 ]);
 if(user.error||!user.data||(action==="grant"&&!user.data.is_active)||
    (action==="grant"&&!["client","partner"].includes(user.data.role))||
    property.error||!property.data)
  return {status:"error",message:"Active account or property not found. Nothing was saved."};
 const {error}=await db.from("mzs_ops_staff_scope_events").insert({
   profile_id:profileId,property_id:propertyId,action,reason
 });
 if(error)return {status:"error",message:"The assignment could not be processed. Check the previous access state."};
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:action==="grant"?
  "The staff member now has access to this specific property. Other dossier permissions are unchanged.":
  "Property access revoked and the reason recorded."};
}
