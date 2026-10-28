"use server";
import {revalidatePath} from "next/cache";
import {requirePropertyStaff} from "../../lib/security/property-staff";
type StaffActionState={status:"idle"|"success"|"error";message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=/^20\d\d-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/;
function dateValid(value:string){
 if(!day.test(value))return false;
 const result=new Date(value+"T00:00:00Z");
 return !Number.isNaN(result.valueOf())&&result.toISOString().slice(0,10)===value;
}
function nullableId(form:FormData):string|null{
 const id=String(form.get("unit_id")??"");
 if(!id)return null;
 if(!uuid.test(id))throw Error("Bad unit ID");
 return id;
}
/** Per-visit ACTUAL time only. No wages, billable hours, VAT or invoice issue. */
export async function saveActualStaffVisit(_previous:StaffActionState,form:FormData):Promise<StaffActionState>{
 const {db,properties}=await requirePropertyStaff();
 const propertyId=String(form.get("property_id")??"");
 const on=String(form.get("worked_on")??"");
 const minutes=Number(String(form.get("actual_minutes")??""));
 const category=String(form.get("task_category")??"");
 const description=String(form.get("description")??"").trim();
 if(!uuid.test(propertyId)||!properties.some(p=>p.id===propertyId)||
   !dateValid(on)||!Number.isSafeInteger(minutes)||minutes<1||minutes>960||
   !["cleaning","inspection","maintenance","gardening","guest_service","other"].includes(category)||
   description.length<3||description.length>1500){
  return {status:"error",message:"Controleer object, datum, werkelijk gewerkte minuten en werkzaamheden."};
 }
 let unitId:string|null;
 try{unitId=nullableId(form);}catch{return {status:"error",message:"De gekozen unit is ongeldig."};}
 const {error}=await db.from("mzs_ops_staff_visits").insert({
   property_id:propertyId,unit_id:unitId,worked_on:on,
   actual_minutes:minutes,task_category:category,description
 });
 if(error)return {status:"error",message:"Werkbezoek niet geregistreerd. Controleer je objecttoegang, datum en unit."};
 revalidatePath("/staff");
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:"Werkelijke bezoektijd vastgelegd. Dit is geen loonbetaling of cliëntfactuur."};
}
/** Report only, no automatic supplier work order or customer recharge. */
export async function reportMaintenanceTicket(_previous:StaffActionState,form:FormData):Promise<StaffActionState>{
 const {db,properties}=await requirePropertyStaff();
 const propertyId=String(form.get("property_id")??"");
 const priority=String(form.get("priority")??"");
 const title=String(form.get("title")??"").trim();
 const description=String(form.get("description")??"").trim();
 if(!uuid.test(propertyId)||!properties.some(p=>p.id===propertyId)||
   !["routine","soon","urgent"].includes(priority)||
   title.length<5||title.length>140||description.length<8||description.length>3000){
  return {status:"error",message:"Controleer object, urgentie, titel en omschrijving."};
 }
 let unitId:string|null;
 try{unitId=nullableId(form);}catch{return {status:"error",message:"De gekozen unit is ongeldig."};}
 const {error}=await db.from("mzs_ops_maintenance_tickets").insert({
  property_id:propertyId,unit_id:unitId,priority,title,description
 });
 if(error)return {status:"error",message:"Onderhoudsmelding niet opgeslagen. Controleer objectrechten en unit."};
 revalidatePath("/staff");
 revalidatePath("/admin/workspaces/estates/staff");
 return {status:"success",message:"Onderhoudsmelding geregistreerd voor beoordeling. Er is nog geen werkopdracht verstrekt."};
}
