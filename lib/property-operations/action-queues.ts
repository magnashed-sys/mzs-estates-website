import type {createClient} from '../supabase/server';
import {pageNumber,uuid,validDate} from './staff-work';

type DB=Awaited<ReturnType<typeof createClient>>;
export const queues=[
 {key:'overdue',label:'Planning verstreken',description:'Open onderhoud met een geplande datum vóór vandaag.'},
 {key:'triage',label:'Meldingen beoordelen',description:'Nieuwe en heropende onderhoudsmeldingen.'},
 {key:'today',label:'Vandaag gepland',description:'Open onderhoud met een verantwoordelijke en een geplande datum van vandaag.'},
 {key:'planning',label:'Planning aanvullen',description:'Beoordeeld onderhoud zonder datum of verantwoordelijke, voor zover niet al te laat.'},
 {key:'closure',label:'Oplossing controleren',description:'Als opgelost gemeld onderhoud dat nog niet is afgesloten.'},
 {key:'corrections',label:'Uurcorrecties beoordelen',description:'Werkbezoeken met een open correctieverzoek.'},
 {key:'visits',label:'Uren beoordelen',description:'Werkbezoeken zonder beoordeling en zonder open correctieverzoek.'},
 {key:'budgets',label:'Budgetten beoordelen',description:'Conceptwerkopdrachten waarvoor nog geen beslissing is vastgelegd.'}
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
 if(!uuid.test(id))throw Error('Ongeldig dossier');
 return `/admin/workspaces/estates/staff?${key==='visits'||key==='corrections'?'visit':'ticket'}=${id}&inbox=${key}&inboxPage=${pageNumber(String(page))}#${key==='visits'||key==='corrections'?'visit':key==='budgets'?'work-orders':'ticket'}`;
}
const isVisit=(key:QueueKey)=>key==='visits'||key==='corrections';
const columns={visits:'id,property_id,profile_id,worked_on,effective_minutes,description',tickets:'id,property_id,responsible_profile_id,scheduled_for,priority,title,created_at',budgets:'id,ticket_id,quotation_reference,scope_of_work,created_at'};
function query(db:DB,key:QueueKey,today:string,head=false){
 if(!validDate(today))throw Error('Ongeldige peildatum');
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
type Source={id:string;property_id?:string;profile_id?:string;responsible_profile_id?:string|null;worked_on?:string;effective_minutes?:number;description?:string;scheduled_for?:string|null;priority?:string;title?:string;ticket_id?:string;quotation_reference?:string;scope_of_work?:string;created_at?:string};
export type QueueItem={id:string;property:string;person:string;title:string;detail:string;date:string;urgent:boolean;href:string};
export async function loadQueuePage(db:DB,key:QueueKey,requestedPage:number,today:string){
 let page=pageNumber(String(requestedPage));
 let result=await query(db,key,today).range((page-1)*25,page*25-1);
 if(result.error?.code==='PGRST103'||(!result.error&&validCount(result.count)&&page>Math.max(1,Math.ceil(result.count/25)))){
  const count=await query(db,key,today,true);
  if(count.error||!validCount(count.count))throw Error('Actielijst kon niet worden geteld');
  page=Math.max(1,Math.ceil(count.count/25));
  result=await query(db,key,today).range((page-1)*25,page*25-1);
 }
 if(result.error||!result.data||!validCount(result.count))throw Error('Actielijst kon niet volledig worden geladen');
 const source=result.data as unknown as Source[];
 if(source.length!==Math.min(25,Math.max(0,result.count-(page-1)*25))||new Set(source.map(x=>x.id)).size!==source.length)throw Error('Onvolledige actielijst');
 async function lookup<T extends {id:string}>(table:string,select:string,ids:(string|undefined|null)[]):Promise<Map<string,T>>{
  const unique=[...new Set(ids.filter((id):id is string=>typeof id==='string'))];
  if(!unique.length)return new Map();
  if(unique.some(id=>!uuid.test(id)))throw Error('Ongeldige bronverwijzing');
  const r=await db.from(table).select(select).in('id',unique).limit(25);
  const rows=r.data as unknown as T[]|null;
  if(r.error||!rows||rows.length!==unique.length||new Set(rows.map(x=>x.id)).size!==unique.length||rows.some(x=>!unique.includes(x.id)))throw Error('Dossiergegevens ontbreken');
  return new Map(rows.map(x=>[x.id,x]));
 }
 const tickets=key==='budgets'?await lookup<{id:string;property_id:string;title:string}>('mzs_ops_current_tickets','id,property_id,title',source.map(x=>x.ticket_id)):new Map<string,{id:string;property_id:string;title:string}>();
 const [properties,people]=await Promise.all([
  lookup<{id:string;name:string}>('mzs_estate_properties','id,name',source.map(x=>x.property_id??tickets.get(x.ticket_id??'')?.property_id)),
  lookup<{id:string;full_name:string|null}>('profiles','id,full_name',source.map(x=>isVisit(key)?x.profile_id:x.responsible_profile_id))
 ]);
 const items:QueueItem[]=source.map(row=>{
  const ticket=tickets.get(row.ticket_id??'');
  const property=properties.get(row.property_id??ticket?.property_id??'');
  if(!property)throw Error('Object ontbreekt');
  const personId=isVisit(key)?row.profile_id:row.responsible_profile_id;
  return {id:row.id,property:property.name,person:personId?(people.get(personId)?.full_name??'Naam ontbreekt'):'Nog niet toegewezen',
   title:isVisit(key)?`${row.effective_minutes} minuten`:key==='budgets'?row.quotation_reference??'Werkopdracht':row.title??'Onderhoud',
   detail:isVisit(key)?row.description??'':key==='budgets'?`${ticket?.title} · ${row.scope_of_work}`:'',
   date:isVisit(key)?row.worked_on??'':key==='budgets'?row.created_at?.slice(0,10)??'':row.scheduled_for??'Nog niet gepland',
   urgent:row.priority==='urgent',href:dossierHref(key,key==='budgets'?row.ticket_id??'':row.id,page)};
 });
 return {items,page,total:result.count,pages:Math.max(1,Math.ceil(result.count/25))};
}
