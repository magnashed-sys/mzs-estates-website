"use server";

import {revalidatePath} from "next/cache";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";

export type ExpenseDraftState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories=[
 "electricity","gas","water","cleaning","internet","insurance",
 "taxes","maintenance","materials","management","other"
];
function requiredUuid(form:FormData,name:string):string|null{
 const v=String(form.get(name)??"").trim();
 return uuid.test(v)?v:null;
}
function cents(raw:FormDataEntryValue|null):number|null{
 const s=String(raw??"");
 if(!/^[0-9]{1,12}$/.test(s))return null;
 const n=Number(s);
 return Number.isSafeInteger(n)&&n>=0&&n<=100000000000?n:null;
}
function validDate(d:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;
 const t=new Date(d+"T00:00:00Z");
 return !Number.isNaN(t.valueOf())&&t.toISOString().slice(0,10)===d;
}

/** Creates only an immutable draft, never a supplier payment or a customer invoice. */
export async function savePropertyExpenseDraft(
 _previous:ExpenseDraftState,formData:FormData
):Promise<ExpenseDraftState>{
 if(process.env.VERCEL_ENV!=="preview"||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
   return {status:"error",message:"Inkoopconcepten kunnen alleen op MZS Staging worden opgeslagen."};
 const {db}=await requireEstateAdmin();
 const propertyId=requiredUuid(formData,"property_id");
 const entityId=requiredUuid(formData,"legal_entity_id");
 const supplierId=requiredUuid(formData,"supplier_relationship_id");
 const number=String(formData.get("supplier_invoice_number")??"").trim();
 const date=String(formData.get("invoice_date")??"").trim();
 const category=String(formData.get("category")??"").trim();
 const description=String(formData.get("description")??"").trim();
 const net=cents(formData.get("net_cents")),vat=cents(formData.get("vat_cents"));
 const allocationRaw=String(formData.get("allocations")??"");
 if(!propertyId||!entityId||!supplierId||!validDate(date)||
    number.length<1||number.length>100||/[\u0000-\u001f\u007f]/.test(number)||
    description.length<2||description.length>500||/[\u0000-\u001f\u007f]/.test(description)||
    !categories.includes(category)||net===null||vat===null||net+vat<=0||
    allocationRaw.length<2||allocationRaw.length>15000) {
   return {status:"error",message:"Controleer alle verplichte velden en de bedragen."};
 }
 let allocations:{unit_id:string|null;net_cents:number;vat_cents:number}[];
 try{
   const parsed:unknown=JSON.parse(allocationRaw);
   if(!Array.isArray(parsed)||parsed.length<1||parsed.length>100)
     throw new Error("Invalid allocation array");
   const seen=new Set<string>();
   allocations=parsed.map((a:unknown)=>{
     if(!a||typeof a!=="object"||Array.isArray(a))throw new Error("Invalid allocation");
     const row=a as Record<string,unknown>;
     if(row.unit_id!==null && (typeof row.unit_id!=="string"||!uuid.test(row.unit_id)))
       throw new Error("Invalid unit ID");
     const unitId=row.unit_id as string|null;
     const n=row.net_cents,v=row.vat_cents;
     if(typeof n!=="number"||typeof v!=="number"||!Number.isSafeInteger(n)||!Number.isSafeInteger(v)||
        (n as number)<0||(v as number)<0|| (n as number)>100000000000||(v as number)>100000000000)
       throw new Error("Invalid cents");
     const key=unitId??"whole-property";
     if(seen.has(key))throw new Error("Duplicate unit allocation");
     seen.add(key);
     return {unit_id:unitId,net_cents:n as number,vat_cents:v as number};
   });
   if(allocations.reduce((sum,a)=>sum+a.net_cents,0)!==net||
      allocations.reduce((sum,a)=>sum+a.vat_cents,0)!==vat)
      throw new Error("Mismatched amounts");
 }catch{
   return {status:"error",message:"De kostenverdeling is ongeldig of sluit niet aan op de factuurbedragen."};
 }
 const {error}=await db.from("mzs_ops_expense_drafts").insert({
   property_id:propertyId,legal_entity_id:entityId,supplier_relationship_id:supplierId,
   supplier_invoice_number:number,invoice_date:date,category,description,
   net_cents:net,vat_cents:vat,allocations
 });
 if(error?.code==="23505")return {status:"error",message:"Deze leveranciersfactuur is al als concept geregistreerd voor deze entiteit."};
 if(error?.code==="23514")return {status:"error",message:"De gekozen entiteit is op deze datum niet als kostendrager aan dit object gekoppeld."};
 if(error)return {status:"error",message:"Concept kon niet worden opgeslagen. Controleer de gekoppelde units, rechten en Staging-gegevens."};
 revalidatePath("/admin/workspaces/estates/expenses");
 return {status:"success",message:"Inkoopkosten zijn op Staging als concept vastgelegd. Geen betaling, goedkeuring of uitgaande factuur gemaakt."};
}
