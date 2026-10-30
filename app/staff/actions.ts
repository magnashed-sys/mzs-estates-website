"use server";
import {revalidateOperations} from '../../lib/property-operations/revalidate';
import {requirePropertyStaff} from "../../lib/security/property-staff";
import {staffTaskEnvironment,validateTaskPlacement} from "../../lib/property-operations/property-tasks";
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
 const {db,properties,user}=await requirePropertyStaff();
 const propertyId=String(form.get("property_id")??"");
 const workAreaId=String(form.get("work_area_id")??"");
 const on=String(form.get("worked_on")??"");
 const hoursField=form.get('hours'),minutesField=form.get('minutes');
 const fromClock=hoursField!==null||minutesField!==null;
 const hours=typeof hoursField==='string'&&hoursField.trim()!==''?Number(hoursField):NaN;
 const extraMinutes=typeof minutesField==='string'&&minutesField.trim()!==''?Number(minutesField):NaN;
 const minutes=fromClock?
   (Number.isSafeInteger(hours)&&hours>=0&&hours<=16&&Number.isSafeInteger(extraMinutes)&&extraMinutes>=0&&extraMinutes<=59?
    hours*60+extraMinutes:NaN):
   Number(String(form.get('actual_minutes')??''));
 const category=String(form.get("task_category")??"");
 const description=String(form.get("description")??"").trim();
 if((!!propertyId)===(!!workAreaId) ||
   (propertyId&&(!uuid.test(propertyId)||!properties.some(p=>p.id===propertyId))) ||
   (workAreaId&&!['maintenance-beverwijk','private-magdy'].includes(workAreaId)) ||
   !dateValid(on)||!Number.isSafeInteger(minutes)||minutes<1||minutes>960||
   !["cleaning","inspection","maintenance","gardening","guest_service","other"].includes(category)||
   description.length<3||description.length>1500){
  return {status:"error",message:"Controleer object, datum, werkelijk gewerkte minuten en werkzaamheden."};
 }
 let unitId:string|null;
 try{unitId=nullableId(form);}catch{return {status:"error",message:"De gekozen unit is ongeldig."};}
 if(workAreaId&&unitId)return {status:'error',message:'Operational locations do not have rental units.'};
 if(workAreaId){
  const {data:area,error:areaError}=await db.from('mzs_ops_staff_work_area_directory')
   .select('id').eq('id',workAreaId).maybeSingle();
  if(areaError||!area)return {status:'error',message:'Work location not assigned to your account.'};
 }
 let taskId:string|null=null;
 if(staffTaskEnvironment()){
  const raw=String(form.get('task_id')??'');
  if(raw){
   if(!uuid.test(raw))return {status:'error',message:'Invalid task selection.'};
   const {data:task,error:taskError}=await db.from('mzs_ops_property_tasks')
    .select('id,property_id,work_area_id,unit_id,assigned_profile_id').eq('id',raw).maybeSingle();
   if(taskError||!task||task.assigned_profile_id!==user.id||
      !(workAreaId?
         task.work_area_id===workAreaId&&task.property_id===null&&unitId===null:
         task.work_area_id===null&&validateTaskPlacement(task,{property_id:propertyId,unit_id:unitId})))
    return {status:'error',message:'Task must belong to your assigned work location and unit.'};
   taskId=raw;
  }
 }else if(form.get('task_id'))return {status:'error',message:'Task linking not available.'};
 const payload:Record<string,unknown>={property_id:propertyId||null,work_area_id:workAreaId||null,unit_id:unitId,worked_on:on,
  actual_minutes:minutes,task_category:category,description};
 if(taskId)payload.task_id=taskId;
 const {error}=await db.from("mzs_ops_staff_visits").insert(payload);
 if(error)return {status:"error",message:"Werkbezoek niet geregistreerd. Controleer je objecttoegang, datum en unit."};
 revalidateOperations();
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
 revalidateOperations();
 return {status:"success",message:"Onderhoudsmelding geregistreerd voor beoordeling. Er is nog geen werkopdracht verstrekt."};
}
