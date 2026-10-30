import type {createClient} from '../supabase/server';
import {uuid,validDate,pageNumber} from './staff-work';
import {accountantCsv} from './finance';
import {operationsDay} from './action-queues';

/** Location filters are mutually exclusive; work areas never masquerade as estate properties. */
export type TimeFilters={from:string;until:string;property:string;area:string;profile:string;page:number};
export const timeStates={approved:"Approved",pending:"Awaiting review",correction:"Correction pending",returned:"Returned"} as const;
export type TimeState=keyof typeof timeStates;
export const areaId=/^[a-z][a-z0-9-]{1,63}$/;
type SourceVisit={
 id:string;property_id:string|null;work_area_id:string|null;unit_id:string|null;task_id:string|null;
 profile_id:string;worked_on:string;actual_minutes:number;effective_minutes:number;
 task_category:string;description:string;correction_id:string|null;
 review_decision:'approved'|'rejected'|null;reviewed_at:string|null;correction_pending:boolean
};
type Option={id:string;name:string};
type UnitOption=Option&{property_id:string};
export type TimeVisit=SourceVisit&{
 state:TimeState;property_name:string;work_area_name:string;location_name:string;
 location_key:string;location_kind:'property'|'area';unit_name:string;
 person_name:string;week_start:string
};
type Bucket={count:number;minutes:number};
export type TimeTotals={count:number;minutes:number;originalMinutes:number}&Record<TimeState,Bucket>;
export type TimeReport={
 generatedAt:string;filters:TimeFilters;properties:Option[];areas:Option[];units:UnitOption[];
 people:Option[];visits:TimeVisit[];total:TimeTotals;
 byPerson:[string,TimeTotals][];byProperty:[string,TimeTotals][];byLocation:[string,TimeTotals][];
 byUnit:[string,TimeTotals][];byWeek:[string,TimeTotals][];byPersonWeek:[string,TimeTotals][];byMonth:[string,TimeTotals][]
};
export function timeFilters(params:Record<string,string|string[]|undefined>,now=new Date()):TimeFilters{
 const read=(key:string,fallback=''):string=>{
  const value=params[key];
  if(typeof value==='string')return value;
  if(value===undefined)return fallback;
  throw Error("Invalid report filter");
 };
 const today=operationsDay(now),from=read('from',today.slice(0,7)+'-01'),until=read('until',today);
 const location=read('location'),profile=read('profile');
 let property=read('property'),area=read('area');
 if(location){
  if(property||area)throw Error("Do not combine location and property/area filters.");
  if(location.startsWith('property:'))property=location.slice(9);
  else if(location.startsWith('area:'))area=location.slice(5);
  else throw Error("Invalid work location filter.");
 }
 if(!validDate(from)||!validDate(until)||from>until||(Date.parse(until)-Date.parse(from))/86400000>365)
  throw Error("Choose a valid period of up to 366 days.");
 if((property&&!uuid.test(property))||(area&&!areaId.test(area))||(profile&&!uuid.test(profile))||(property&&area))
  throw Error("Choose either one property or one operational work area, and an optional worker.");
 return {from,until,property:property.toLowerCase(),area:area.toLowerCase(),profile:profile.toLowerCase(),page:pageNumber(read('page','1'))};
}
export function timeReportHref(filters:TimeFilters,page=1,csv=false){
 const q=new URLSearchParams({from:filters.from,until:filters.until});
 if(filters.property)q.set('property',filters.property);
 if(filters.area)q.set('area',filters.area);
 if(filters.profile)q.set('profile',filters.profile);
 if(!csv)q.set('page',String(pageNumber(String(page))));
 return '/admin/workspaces/estates/time-report'+(csv?'/export':'')+'?'+q;
}
export function timeDossierHref(filters:TimeFilters,id:string){
 if(!uuid.test(id))throw Error("Invalid work visit");
 const q=new URLSearchParams({visit:id,reportFrom:filters.from,reportUntil:filters.until,reportProperty:filters.property,reportArea:filters.area,reportProfile:filters.profile,reportPage:String(filters.page)});
 return '/admin/workspaces/estates/staff?'+q+'#visit';
}
export function timeReturnHref(params:Record<string,string|string[]|undefined>){
 if(!params.reportFrom||!params.reportUntil)return null;
 try{
  return timeReportHref(timeFilters({
   from:params.reportFrom,until:params.reportUntil,property:params.reportProperty,
   area:params.reportArea,profile:params.reportProfile,page:params.reportPage
  }),pageNumber(typeof params.reportPage==='string'?params.reportPage:undefined))+'#visits';
 }catch{return null;}
}
export function workDuration(minutes:number){
 if(!Number.isSafeInteger(minutes)||minutes<0)throw Error("Invalid duration");
 return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;
}
/** Monday of the ISO 8601 week in UTC, independent of the browser timezone. */
export function weekStart(isoDay:string){
 if(!validDate(isoDay))throw Error("Invalid work date");
 const day=new Date(isoDay+'T00:00:00.000Z');
 const offset=(day.getUTCDay()+6)%7;
 day.setUTCDate(day.getUTCDate()-offset);
 return day.toISOString().slice(0,10);
}
const totals=():TimeTotals=>({
 count:0,minutes:0,originalMinutes:0,
 approved:{count:0,minutes:0},pending:{count:0,minutes:0},
 correction:{count:0,minutes:0},returned:{count:0,minutes:0}
});
function add(total:TimeTotals,row:TimeVisit){
 total.count++;total.minutes+=row.effective_minutes;total.originalMinutes+=row.actual_minutes;
 total[row.state].count++;total[row.state].minutes+=row.effective_minutes;
}
function grouped(map:Map<string,TimeTotals>,key:string,row:TimeVisit){
 const bucket=map.get(key)??totals();add(bucket,row);map.set(key,bucket);
}
export function normalizeTimeReport(source:unknown,filters:TimeFilters):TimeReport{
 const fail=():never=>{throw Error("The time source is incomplete or has changed. Refresh the report.");};
 if(!source||typeof source!=='object'||Array.isArray(source))return fail();
 const s=source as Record<string,unknown>;
 if(s.schema_version!==2||s.from!==filters.from||s.until!==filters.until||
   s.property!==(filters.property||null)||s.area!==(filters.area||null)||
   s.profile!==(filters.profile||null)||typeof s.generated_at!=='string'||
   !Number.isFinite(Date.parse(s.generated_at)))return fail();
 function directory(value:unknown,field:'name'|'full_name',kind:'uuid'|'area'='uuid'):Option[]{
  if(!Array.isArray(value)||value.length>10000)return fail();
  const ids=new Set<string>();
  return value.map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row))return fail();
   const o=row as Record<string,unknown>;
   if(typeof o.id!=='string'||!(kind==='uuid'?uuid.test(o.id):areaId.test(o.id))||
     ids.has(o.id)||(o[field]!==null&&typeof o[field]!=='string'))return fail();
   ids.add(o.id);
   return {id:o.id,name:(o[field] as string|null)?.trim()||
    (field==='full_name'?'Unnamed account':'Unnamed work location')};
  }).sort((a,b)=>a.name.localeCompare(b.name,'nl')||a.id.localeCompare(b.id));
 }
 const properties=directory(s.properties,'name'),people=directory(s.people,'full_name');
 const areas=directory(s.areas,'name','area');
 if(!Array.isArray(s.units)||s.units.length>10000)return fail();
 const pm=new Map(properties.map(p=>[p.id,p.name])),am=new Map(areas.map(a=>[a.id,a.name])),wm=new Map(people.map(p=>[p.id,p.name]));
 const unitSeen=new Set<string>();
 const units:UnitOption[]=s.units.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))return fail();
  const unit=row as Record<string,unknown>;
  if(typeof unit.id!=='string'||!uuid.test(unit.id)||unitSeen.has(unit.id)||
    typeof unit.property_id!=='string'||!pm.has(unit.property_id)||
    typeof unit.address!=='string'||!unit.address.trim())return fail();
  unitSeen.add(unit.id);
  return {id:unit.id,property_id:unit.property_id,name:unit.address.trim()};
 });
 const um=new Map(units.map(u=>[u.id,u]));
 if((filters.property&&!pm.has(filters.property))||(filters.area&&!am.has(filters.area))||
   (filters.profile&&!wm.has(filters.profile)))return fail();
 if(!Array.isArray(s.visits)||s.visits.length>10000||s.record_count!==s.visits.length)return fail();
 const seen=new Set<string>(),total=totals(),byPerson=new Map<string,TimeTotals>(),
  byProperty=new Map<string,TimeTotals>(),byLocation=new Map<string,TimeTotals>(),
  byUnit=new Map<string,TimeTotals>(),byWeek=new Map<string,TimeTotals>(),byPersonWeek=new Map<string,TimeTotals>(),
  byMonth=new Map<string,TimeTotals>();
 const visits:TimeVisit[]=s.visits.map((row:SourceVisit)=>{
  if(!row||typeof row.id!=='string'||!uuid.test(row.id)||seen.has(row.id)||
   !wm.has(row.profile_id)||!validDate(row.worked_on)||
   row.worked_on<filters.from||row.worked_on>filters.until||
   (filters.property&&row.property_id!==filters.property)||
   (filters.area&&row.work_area_id!==filters.area)||
   (filters.profile&&row.profile_id!==filters.profile)||
   (row.property_id===null)===(row.work_area_id===null)||
   (row.property_id!==null&&!pm.has(row.property_id))||
   (row.work_area_id!==null&&(!areaId.test(row.work_area_id)||!am.has(row.work_area_id)))||
   (row.unit_id!==null&&
    (row.property_id===null||!um.has(row.unit_id)||um.get(row.unit_id)?.property_id!==row.property_id))||
   (row.task_id!==null&&(!row.task_id||!uuid.test(row.task_id)))||
   [row.actual_minutes,row.effective_minutes].some(n=>!Number.isInteger(n)||n<1||n>960)||
   typeof row.correction_pending!=='boolean'||!['approved','rejected',null].includes(row.review_decision)||
   typeof row.task_category!=='string'||typeof row.description!=='string'||
   (row.correction_id!==null&&(typeof row.correction_id!=='string'||!uuid.test(row.correction_id)))||
   (row.correction_id===null&&row.actual_minutes!==row.effective_minutes)||
   (row.review_decision===null?row.reviewed_at!==null:
    typeof row.reviewed_at!=='string'||!Number.isFinite(Date.parse(row.reviewed_at))))return fail();
  seen.add(row.id);
  const property_name=row.property_id===null?'':pm.get(row.property_id)!;
  const work_area_name=row.work_area_id===null?'':am.get(row.work_area_id)!;
  const location_key=row.property_id===null?'area:'+row.work_area_id:'property:'+row.property_id;
  const state:TimeState=row.correction_pending?'correction':
   row.review_decision==='approved'?'approved':row.review_decision==='rejected'?'returned':'pending';
  const visit:TimeVisit={...row,state,property_name,work_area_name,location_key,
   location_name:property_name||work_area_name,location_kind:row.property_id===null?'area':'property',
   unit_name:row.unit_id?um.get(row.unit_id)!.name:'',person_name:wm.get(row.profile_id)!,
   week_start:weekStart(row.worked_on)};
  add(total,visit);
  grouped(byPerson,row.profile_id,visit);
  if(row.property_id!==null){
   grouped(byProperty,row.property_id,visit);
   grouped(byUnit,row.property_id+':'+(row.unit_id??'all'),visit);
  }
  grouped(byLocation,location_key,visit);
  grouped(byMonth,row.worked_on.slice(0,7),visit);
  grouped(byWeek,visit.week_start,visit);
  grouped(byPersonWeek,row.profile_id+':'+visit.week_start,visit);
  return visit;
 }).sort((a,b)=>a.worked_on.localeCompare(b.worked_on)||a.id.localeCompare(b.id));
 const sorted=(map:Map<string,TimeTotals>)=>[...map].sort(([a],[b])=>a.localeCompare(b));
 return {generatedAt:s.generated_at as string,filters,properties,areas,units,people,visits,total,
  byPerson:sorted(byPerson),byProperty:sorted(byProperty),byLocation:sorted(byLocation),
  byUnit:sorted(byUnit),byWeek:sorted(byWeek),byPersonWeek:sorted(byPersonWeek),byMonth:sorted(byMonth)};
}
export async function loadTimeReport(db:Awaited<ReturnType<typeof createClient>>,filters:TimeFilters){
 const {data,error}=await db.rpc('mzs_ops_staff_time_report_v2',{
  p_from:filters.from,p_until:filters.until,p_property:filters.property||null,
  p_profile:filters.profile||null,p_area:filters.area||null
 });
 if(error)throw Error("Time report unavailable. Narrow the period or filters if needed and retry.");
 return normalizeTimeReport(data,filters);
}
export function timeReportCsv(report:TimeReport){
 const fields=['snapshot_at','period_from','period_until','visit_id','worked_on','week_start',
  'location_type','property_id','property','work_area_id','work_area','unit_id','unit','task_id',
  'profile_id','employee','category','original_minutes','current_minutes','approved_minutes',
  'current_hours_minutes','report_state','last_review_decision','reviewed_at',
  'approved_correction_id','correction_pending','description'];
 return accountantCsv(fields,report.visits.map(v=>({
  snapshot_at:report.generatedAt,period_from:report.filters.from,period_until:report.filters.until,
  visit_id:v.id,worked_on:v.worked_on,week_start:v.week_start,location_type:v.location_kind,
  property_id:v.property_id??'',property:v.property_name,
  work_area_id:v.work_area_id??'',work_area:v.work_area_name,
  unit_id:v.unit_id??'',unit:v.unit_name,task_id:v.task_id??'',
  profile_id:v.profile_id,employee:v.person_name,category:v.task_category,
  original_minutes:v.actual_minutes,current_minutes:v.effective_minutes,
  approved_minutes:v.state==='approved'?v.effective_minutes:0,
  current_hours_minutes:workDuration(v.effective_minutes),report_state:v.state,
  last_review_decision:v.review_decision,reviewed_at:v.reviewed_at,
  approved_correction_id:v.correction_id,correction_pending:v.correction_pending,
  description:v.description
 })));
}
