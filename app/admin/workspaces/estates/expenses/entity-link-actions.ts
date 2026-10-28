"use server";

import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type EntityLinkState={status:"idle"|"success"|"error";message:string};
export const initialEntityLinkState:EntityLinkState={status:"idle",message:""};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Staging-only controlled administrative attribution.
 * Selection is never inferred from a property name or from a WhatsApp message.
 */
export async function addVerifiedPropertyEntityLink(
  _previous:EntityLinkState, formData:FormData
):Promise<EntityLinkState>{
  if(process.env.VERCEL_ENV!=="preview" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co") {
    return {status:"error",message:"Toewijzingen kunnen uitsluitend op de geïsoleerde Staging-omgeving worden getest."};
  }
  const {db}=await requireEstateAdmin();
  const propertyId=String(formData.get("property_id")??"").trim();
  const legalEntityId=String(formData.get("legal_entity_id")??"").trim();
  const relationship=String(formData.get("relationship_type")??"").trim();
  const effectiveFrom=String(formData.get("effective_from")??"").trim();
  const evidence=String(formData.get("evidence_reference")??"").trim();
  const confirmed=formData.get("confirmed")==="yes";

  if(!confirmed)return {status:"error",message:"Bevestig dat je de juridische of administratieve grondslag hebt gecontroleerd."};
  if(!uuid.test(propertyId)||!uuid.test(legalEntityId)||
    !["owner","payer","manager"].includes(relationship)){
    return {status:"error",message:"Selecteer een geldig object, juridische entiteit en relatietype."};
  }
  const date=/^\d{4}-\d{2}-\d{2}$/;
  if(!date.test(effectiveFrom)||
    Number.isNaN(Date.parse(effectiveFrom+"T00:00:00Z"))||
    new Date(effectiveFrom+"T00:00:00Z").toISOString().slice(0,10)!==effectiveFrom) {
    return {status:"error",message:"Controleer de ingangsdatum."};
  }
  if(evidence.length<6||evidence.length>500||/[\u0000-\u001f\u007f]/u.test(evidence)){
    return {status:"error",message:"Geef een geldige bronomschrijving (6 tot 500 tekens) op."};
  }
  const [property,issuer]=await Promise.all([
    db.from("mzs_estate_properties").select("id").eq("id",propertyId).maybeSingle(),
    db.from("mzs_lease_issuers").select("id").eq("id",legalEntityId).maybeSingle()
  ]);
  if(property.error||issuer.error||!property.data||!issuer.data){
    return {status:"error",message:"Het object of de entiteit is niet gevonden. Er is niets opgeslagen."};
  }

  const {error}=await db.from("mzs_ops_property_entity_links").insert({
    property_id:propertyId,
    legal_entity_id:legalEntityId,
    relationship_type:relationship,
    effective_from:effectiveFrom,
    evidence_reference:evidence
  });
  if(error?.code==="23505")return {status:"error",message:"Deze koppeling met dezelfde ingangsdatum bestaat al."};
  if(error)return {status:"error",message:"De koppeling is niet opgeslagen. Controleer de Staging-database en je rechten."};
  revalidatePath("/admin/workspaces/estates/expenses");
  return {status:"success",message:"De gecontroleerde koppeling is op Staging vastgelegd met een auditregistratie."};
}
