import type {createClient} from '../supabase/server';
import {pageNumber,uuid,validDate} from './staff-work';

type DB=Awaited<ReturnType<typeof createClient>>;
export const queues=[
 {key:'overdue',label:'Planning verstreken',description:"Open maintenance scheduled before today."},
 {key:'triage',label:"Review maintenance reports",description:"New and reopened maintenance reports."},
 {key:'today',label:"Scheduled today",description:"Open maintenance with an assigned person and a scheduled date of today."},
 {key:'planning',label:'Planning aanvullen',description:"Reviewed maintenance without a date or assignee, unless already overdue."},
 {key:'closure',label:"Review resolution",description:"Maintenance reported as resolved but not yet closed."},
 {key:'corrections',label:"Review time corrections",description:"Work visits with an open correction request."},
 {key:'visits',label:"Review time entries",description:"Work visits without a review or an open correction request."},
 {key:'budgets',label:"Review budgets",description:"Draft work orders awaiting a decision."}
] as const;
export type QueueKey=typeof queues[number]['key'];
export function queueKey(value:unknown):QueueKey|null{return typeof value==='string'&&queues.some(q=>q.key===value)?value as QueueKey:null;}
export function operationsDay(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function queueHref(key:QueueKey,page=1){return `/admin/workspaces/estates/actions?queue=${key}&page=${pageNumber(String(page))}`;}
export function dossierHref(key:QueueKey,id:string,page=1){
 if(!uuid.test(id))throw Error("Invalid dossier");
 return `/admin/workspaces/estates/staff?${key==='visits'||key==='corrections'?'visit':'ticket'}=${id}&inbox=${key}&inboxPage=${pageNumber(String(page))}#${key==='visits'||key==='corrections'?'visit':key==='budgets'?'work-orders':'ticket'}`;
}
const isVisit=(key:QueueKey)=>key==='visits'||key==='corrections';
const columns={visits:'id,property_id,work_area_id,profile_id,worked_on,effective_minutes,description',tickets:'id,property_id,responsible_profile_id,scheduled_for,priority,title,created_at',budgets:'id,ticket_id,quotation_reference,scope_of_work,created_at'};
function query(db:DB,key:QueueKey,today:string,head=false){
 if(!validDate(today))throw Error("Invalid reporting date");
 const table=isVisit(key)?'mzs_ops_current_visits':key==='budgets'?'mzs_ops_current_work_orders':'mzs_ops_current_tickets';
 let q=db.from(table).select(head?'id':isVisit(key)?columns.visits:key==='budgets'?columns.budgets:columns.tickets,{count:'exact',head});
 if(key==='visits')q=q.is('review_decision',null).eq('correction_pending',false);
 else if(key==='corrections')q=q.eq('correction_pending',true);
 else if(key==='budgets')q=q.eq('decision','draft');
 else if(key==='triage')q=q.in('status',['reported','reopened']);
 else if(key==='closure')q=q.eq('status','resolved');
 else {
  q=q.in('status',['triaged','scheduled','in_progress']);
  q=key==='overdue'?q.lt('scheduled_for',today):key==='today'?q.eq('scheduled_for',today).not('responsible_profile_id','is',null):q.or(`scheduled_for.is.null,and(responsible_profile_id.is.null,scheduled_for.gte.${today})`);
 }
 if(!head){
  if(isVisit(key))q=q.order('worked_on');
  else if(key==='budgets')q=q.order('created_at');
  else q=q.order('priority',{ascending:false}).order(key==='overdue'?'scheduled_for':'created_at');
  q=q.order('id');
 }
 return q;
}
const validCount=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
export async function loadQueueCounts(db:DB,today:string){
 return Promise.all(queues.map(async queue=>{
  try{const r=await query(db,queue.key,today,true);return {...queue,count:r.error||!validCount(r.count)?null:r.count};}
  catch{return {...queue,count:null};}
 }));
}
type Source={id:string;property_id?:string|null;work_area_id?:string|null;profile_id?:string;responsible_profile_id?:string|null;worked_on?:string;effective_minutes?:number;description?:string;scheduled_for?:string|null;priority?:string;title?:string;ticket_id?:string;quotation_reference?:string;scope_of_work?:string;created_at?:string};
export type QueueItem={id:string;property:string;person:string;title:string;detail:string;date:string;urgent:boolean;href:string};
export async function loadQueuePage(db:DB,key:QueueKey,requestedPage:number,today:string){
 let page=pageNumber(String(requestedPage));
 let result=await query(db,key,today).range((page-1)*25,page*25-1);
 if(result.error?.code==='PGRST103'||(!result.error&&validCount(result.count)&&page>Math.max(1,Math.ceil(result.count/25)))){
  const count=await query(db,key,today,true);
  if(count.error||!validCount(count.count))throw Error("Action list could not be counted");
  page=Math.max(1,Math.ceil(count.count/25));
  result=await query(db,key,today).range((page-1)*25,page*25-1);
 }
 if(result.error||!result.data||!validCount(result.count))throw Error("Action list could not be fully loaded");
 const source=result.data as unknown as Source[];
 if(source.length!==Math.min(25,Math.max(0,result.count-(page-1)*25))||new Set(source.map(x=>x.id)).size!==source.length)throw Error("Incomplete action list");
 async function lookup<T extends {id:string}>(table:string,select:string,ids:(string|undefined|null)[]):Promise<Map<string,T>>{
  const unique=[...new Set(ids.filter((id):id is string=>typeof id==='string'))];
  if(!unique.length)return new Map();
  if(unique.some(id=>!uuid.test(id)))throw Error("Invalid source reference");
  const r=await db.from(table).select(select).in('id',unique).limit(25);
  const rows=r.data as unknown as T[]|null;
  if(r.error||!rows||rows.length!==unique.length||new Set(rows.map(x=>x.id)).size!==unique.length||rows.some(x=>!unique.includes(x.id)))throw Error("Dossier data is missing");
  return new Map(rows.map(x=>[x.id,x]));
 }
 const tickets=key==='budgets'?await lookup<{id:string;property_id:string;title:string}>('mzs_ops_current_tickets','id,property_id,title',source.map(x=>x.ticket_id)):new Map<string,{id:string;property_id:string;title:string}>();
 const areaIds=[...new Set(source.map(x=>x.work_area_id).filter((id):id is string=>typeof id==='string'))];
 if(areaIds.some(id=>!['maintenance-beverwijk','private-magdy'].includes(id)))throw Error('Invalid work-area reference');
 const [properties,people,areas]=await Promise.all([
  lookup<{id:string;name:string}>('mzs_estate_properties','id,name',source.map(x=>x.property_id??tickets.get(x.ticket_id??'')?.property_id)),
  lookup<{id:string;full_name:string|null}>('profiles','id,full_name',source.map(x=>isVisit(key)?x.profile_id:x.responsible_profile_id)),
  areaIds.length?db.from('mzs_ops_staff_work_areas').select('id,name').in('id',areaIds).limit(25):Promise.resolve({data:[],error:null})
 ]);
 if(areas.error||!areas.data||areas.data.length!==areaIds.length)throw Error('Work-area data missing');
 const areaNames=new Map(areas.data.map(row=>[row.id,row.name]));
 const items:QueueItem[]=source.map(row=>{
  const ticket=tickets.get(row.ticket_id??'');
  const property=properties.get(row.property_id??ticket?.property_id??'');
  const area=row.work_area_id?areaNames.get(row.work_area_id):undefined;
  if(!property&&!area)throw Error("Work location missing");
  const personId=isVisit(key)?row.profile_id:row.responsible_profile_id;
  return {id:row.id,property:property?.name??area!,person:personId?(people.get(personId)?.full_name??"Name missing"):"Not yet assigned",
   title:isVisit(key)?`${row.effective_minutes} minutes`:key==='budgets'?row.quotation_reference??"Work order":row.title??"Maintenance",
   detail:isVisit(key)?row.description??'':key==='budgets'?`${ticket?.title} · ${row.scope_of_work}`:'',
   date:isVisit(key)?row.worked_on??'':key==='budgets'?row.created_at?.slice(0,10)??'':row.scheduled_for??"Not yet scheduled",
   urgent:row.priority==='urgent',href:dossierHref(key,key==='budgets'?row.ticket_id??'':row.id,page)};
 });
 return {items,page,total:result.count,pages:Math.max(1,Math.ceil(result.count/25))};
}
