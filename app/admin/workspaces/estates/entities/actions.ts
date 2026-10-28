"use server";
import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type EntityLinkActionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const page="/admin/workspaces/estates/entities";
const prod="https://ptrnjzmcehrhbsfxntgw.supabase.co";
const stage="https://senonkpxdtlhyhrubicg.supabase.co";

function allowedEnvironment(){
 return (process.env.VERCEL_ENV==="production" && process.env.NEXT_PUBLIC_SUPABASE_URL===prod) ||
 (process.env.VERCEL_ENV==="preview" && process.env.NEXT_PUBLIC_SUPABASE_URL===stage);
}
function realDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z");
 return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
/** Append-only administrative attribution, NOT a contract, invoice or payment. */
export async function addPropertyEntityLink(
 _previous:EntityLinkActionState,form:FormData
):Promise<EntityLinkActionState>{
 // Direct server action must fail closed before accessing any real database.
 if(!allowedEnvironment())
  return {status:"error",message:"Deze administratie is niet beschikbaar in deze omgeving."};
 const {db}=await requireEstateAdmin();
 const propertyId=String(form.get("property_id")??"").trim();
 const entityId=String(form.get("legal_entity_id")??"").trim();
 const relation=String(form.get("relationship_type")??"").trim();
 const effectiveFrom=String(form.get("effective_from")??"").trim();
 const evidence=String(form.get("evidence_reference")??"").trim();
 if(form.get("confirmed")!=="yes")
  return {status:"error",message:"Bevestig eerst dat je de juridische of administratieve onderbouwing hebt gecontroleerd."};
 if(!uuid.test(propertyId)||!uuid.test(entityId)||!["owner","payer","manager"].includes(relation))
  return {status:"error",message:"Selecteer een bestaand object, een juridische entiteit en het relatietype."};
 if(!realDate(effectiveFrom))
  return {status:"error",message:"Controleer de ingangsdatum van de koppeling."};
 if(evidence.length<6||evidence.length>500||/[\u0000-\u001f\u007f]/u.test(evidence))
  return {status:"error",message:"Vul een gecontroleerde bewijsbron van 6 tot 500 tekens in."};
 const [property,issuer]=await Promise.all([
  db.from("mzs_estate_properties").select("id").eq("id",propertyId).maybeSingle(),
  db.from("mzs_lease_issuers").select("id").eq("id",entityId).maybeSingle()
 ]);
 if(property.error||issuer.error||!property.data||!issuer.data)
  return {status:"error",message:"Het object of de juridische entiteit is niet gevonden; er is niets opgeslagen."};
 const {error}=await db.from("mzs_ops_property_entity_links").insert({
  property_id:propertyId,legal_entity_id:entityId,relationship_type:relation,
  effective_from:effectiveFrom,evidence_reference:evidence
 });
 if(error?.code==="23505")
  return {status:"error",message:"Deze combinatie met dezelfde ingangsdatum bestaat al."};
 if(error)
  return {status:"error",message:"De koppeling is niet geregistreerd. Er zijn geen bestaande gegevens aangepast."};
 revalidatePath(page);
 return {status:"success",message:"De koppeling en de auditregistratie zijn vastgelegd. Er is geen factuur of betaling aangemaakt."};
}
