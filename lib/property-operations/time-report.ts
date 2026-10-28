import type {createClient} from '../supabase/server';
import {uuid,validDate,pageNumber} from './staff-work';
import {accountantCsv} from './finance';
import {operationsDay} from './action-queues';

export type TimeFilters={from:string;until:string;property:string;profile:string;page:number};
export const timeStates={approved:'Goedgekeurd',pending:'Te beoordelen',correction:'Correctie open',returned:'Teruggestuurd'} as const;
export type TimeState=keyof typeof timeStates;
type SourceVisit={id:string;property_id:string;profile_id:string;worked_on:string;actual_minutes:number;effective_minutes:number;task_category:string;description:string;correction_id:string|null;review_decision:'approved'|'rejected'|null;reviewed_at:string|null;correction_pending:boolean};
type Option={id:string;name:string};
export type TimeVisit=SourceVisit&{state:TimeState;property_name:string;person_name:string};
type Bucket={count:number;minutes:number};
export type TimeTotals={count:number;minutes:number;originalMinutes:number}&Record<TimeState,Bucket>;
export type TimeReport={generatedAt:string;filters:TimeFilters;properties:Option[];people:Option[];visits:TimeVisit[];total:TimeTotals;byPerson:[string,TimeTotals][];byProperty:[string,TimeTotals][];byMonth:[string,TimeTotals][]};
export function timeFilters(params:Record<string,string|string[]|undefined>,now=new Date()):TimeFilters{
 const read=(key:string,fallback=''):string=>{const value=params[key];if(typeof value==='string')return value;if(value===undefined)return fallback;throw Error('Ongeldig rapportfilter');};
 const today=operationsDay(now),from=read('from',today.slice(0,7)+'-01'),until=read('until',today),property=read('property'),profile=read('profile');
 if(!validDate(from)||!validDate(until)||from>until||(Date.parse(until)-Date.parse(from))/86400000>365)throw Error('Kies een geldige periode van maximaal 366 dagen.');
 if((property&&!uuid.test(property))||(profile&&!uuid.test(profile)))throw Error('Kies een geldig object en account.');
 return {from,until,property:property.toLowerCase(),profile:profile.toLowerCase(),page:pageNumber(read('page','1'))};
}
export function timeReportHref(filters:TimeFilters,page=1,csv=false){
 const q=new URLSearchParams({from:filters.from,until:filters.until});
 if(filters.property)q.set('property',filters.property);if(filters.profile)q.set('profile',filters.profile);
 if(!csv)q.set('page',String(pageNumber(String(page))));
 return '/admin/workspaces/estates/time-report'+(csv?'/export':'')+'?'+q;
}
export function timeDossierHref(filters:TimeFilters,id:string){
 if(!uuid.test(id))throw Error('Ongeldig werkbezoek');
 const q=new URLSearchParams({visit:id,reportFrom:filters.from,reportUntil:filters.until,reportProperty:filters.property,reportProfile:filters.profile,reportPage:String(filters.page)});
 return '/admin/workspaces/estates/staff?'+q+'#visit';
}
export function timeReturnHref(params:Record<string,string|string[]|undefined>){
 if(!params.reportFrom||!params.reportUntil)return null;
 try{return timeReportHref(timeFilters({from:params.reportFrom,until:params.reportUntil,property:params.reportProperty,profile:params.reportProfile,page:params.reportPage}),pageNumber(typeof params.reportPage==='string'?params.reportPage:undefined))+'#visits';}catch{return null;}
}
export function workDuration(minutes:number){
 if(!Number.isSafeInteger(minutes)||minutes<0)throw Error('Ongeldige tijdsduur');
 return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;
}
const totals=():TimeTotals=>({count:0,minutes:0,originalMinutes:0,approved:{count:0,minutes:0},pending:{count:0,minutes:0},correction:{count:0,minutes:0},returned:{count:0,minutes:0}});
function add(total:TimeTotals,row:TimeVisit){total.count++;total.minutes+=row.effective_minutes;total.originalMinutes+=row.actual_minutes;total[row.state].count++;total[row.state].minutes+=row.effective_minutes;}
export function normalizeTimeReport(source:unknown,filters:TimeFilters):TimeReport{
 const fail=()=>{throw Error('De urenbron is onvolledig of gewijzigd. Vernieuw het rapport.');};
 if(!source||typeof source!=='object'||Array.isArray(source))return fail();
 const s=source as Record<string,unknown>;
 if(s.from!==filters.from||s.until!==filters.until||s.property!==(filters.property||null)||s.profile!==(filters.profile||null)||typeof s.generated_at!=='string'||!Number.isFinite(Date.parse(s.generated_at)))return fail();
 function directory(value:unknown,field:string):Option[]{
  if(!Array.isArray(value)||value.length>10000)return fail();
  const ids=new Set<string>();return value.map(row=>{
   if(!row||typeof row.id!=='string'||!uuid.test(row.id)||ids.has(row.id)||(row[field]!==null&&typeof row[field]!=='string'))return fail();
   ids.add(row.id);return {id:row.id,name:row[field]?.trim()||(field==='name'?'Object zonder naam':'Account zonder naam')};
  }).sort((a,b)=>a.name.localeCompare(b.name,'nl')||a.id.localeCompare(b.id));
 }
 const properties=directory(s.properties,'name'),people=directory(s.people,'full_name');
 const pm=new Map(properties.map(p=>[p.id,p.name])),wm=new Map(people.map(p=>[p.id,p.name]));
 if((filters.property&&!pm.has(filters.property))||(filters.profile&&!wm.has(filters.profile)))return fail();
 if(!Array.isArray(s.visits)||s.visits.length>10000||s.record_count!==s.visits.length)return fail();
 const seen=new Set<string>(),total=totals(),byPerson=new Map<string,TimeTotals>(),byProperty=new Map<string,TimeTotals>(),byMonth=new Map<string,TimeTotals>();
 const visits:TimeVisit[]=s.visits.map((row:SourceVisit)=>{
  if(!row||typeof row.id!=='string'||!uuid.test(row.id)||seen.has(row.id)||!pm.has(row.property_id)||!wm.has(row.profile_id)||!validDate(row.worked_on)||row.worked_on<filters.from||row.worked_on>filters.until||(filters.property&&row.property_id!==filters.property)||(filters.profile&&row.profile_id!==filters.profile)||[row.actual_minutes,row.effective_minutes].some(n=>!Number.isInteger(n)||n<1||n>960)||typeof row.correction_pending!=='boolean'||!['approved','rejected',null].includes(row.review_decision)||typeof row.task_category!=='string'||typeof row.description!=='string'||(row.correction_id!==null&&(typeof row.correction_id!=='string'||!uuid.test(row.correction_id)))||(row.correction_id===null&&row.actual_minutes!==row.effective_minutes)||(row.review_decision===null?row.reviewed_at!==null:typeof row.reviewed_at!=='string'||!Number.isFinite(Date.parse(row.reviewed_at))))return fail();
  seen.add(row.id);
  const state:TimeState=row.correction_pending?'correction':row.review_decision==='approved'?'approved':row.review_decision==='rejected'?'returned':'pending';
  const visit:TimeVisit={...row,state,property_name:pm.get(row.property_id)!,person_name:wm.get(row.profile_id)!};add(total,visit);
  for(const [map,key] of [[byPerson,row.profile_id],[byProperty,row.property_id],[byMonth,row.worked_on.slice(0,7)]] as const){const group=map.get(key)??totals();add(group,visit);map.set(key,group);}
  return visit;
 }).sort((a,b)=>a.worked_on.localeCompare(b.worked_on)||a.id.localeCompare(b.id));
 return {generatedAt:s.generated_at,filters,properties,people,visits,total,byPerson:[...byPerson],byProperty:[...byProperty],byMonth:[...byMonth].sort(([a],[b])=>a.localeCompare(b))};
}
export async function loadTimeReport(db:Awaited<ReturnType<typeof createClient>>,filters:TimeFilters){
 const {data,error}=await db.rpc('mzs_ops_staff_time_report',{p_from:filters.from,p_until:filters.until,p_property:filters.property||null,p_profile:filters.profile||null});
 if(error)throw Error('Urenrapport niet beschikbaar. Beperk zo nodig de periode of filters en probeer opnieuw.');
 return normalizeTimeReport(data,filters);
}
export function timeReportCsv(report:TimeReport){
 const fields=['snapshot_at','period_from','period_until','visit_id','worked_on','property_id','property','profile_id','employee','category','original_minutes','current_minutes','approved_minutes','current_hours_minutes','report_state','last_review_decision','reviewed_at','approved_correction_id','correction_pending','description'];
 return accountantCsv(fields,report.visits.map(v=>({snapshot_at:report.generatedAt,period_from:report.filters.from,period_until:report.filters.until,visit_id:v.id,worked_on:v.worked_on,property_id:v.property_id,property:v.property_name,profile_id:v.profile_id,employee:v.person_name,category:v.task_category,original_minutes:v.actual_minutes,current_minutes:v.effective_minutes,approved_minutes:v.state==='approved'?v.effective_minutes:0,current_hours_minutes:workDuration(v.effective_minutes),report_state:v.state,last_review_decision:v.review_decision,reviewed_at:v.reviewed_at,approved_correction_id:v.correction_id,correction_pending:v.correction_pending,description:v.description})));
}
