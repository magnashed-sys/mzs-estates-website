import {NextRequest} from 'next/server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffEnvironmentAvailable} from '../../../../../../lib/security/property-staff';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import {weekPdf,weekWorkbook,type FrozenVisit,type ClosedWeekReport} from '../../../../../../lib/property-operations/week-export';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Entry={visit_id:string;worked_on:string;property_id:string|null;unit_id:string|null;work_area_id:string|null;actual_minutes:number;approved_minutes:number;category:string;description:string};
export async function GET(request:NextRequest){
 if(!staffEnvironmentAvailable())return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin(),q=new URL(request.url).searchParams;
 if([...q.keys()].some(k=>!['profile','week','format'].includes(k)))return new Response('Invalid export options',{status:400,headers});
 const validOne=(key:string)=>q.getAll(key).length===1?q.get(key)!:'';
 const profile=validOne('profile'),week=validOne('week'),format=validOne('format');
 const date=/^20\d{2}-\d{2}-\d{2}$/;
 if(!uuid.test(profile)||!date.test(week)||!['pdf','xlsx'].includes(format)||
   Number.isNaN(Date.parse(week+'T00:00:00Z'))||
   new Date(week+'T00:00:00Z').toISOString().slice(0,10)!==week||
   new Date(week+'T00:00:00Z').getUTCDay()!==1)
  return new Response('Choose a valid staff member, ISO week and format.',{status:400,headers});
 const {data:event,error:eventError}=await db.from('mzs_ops_current_week_closures')
  .select('id,profile_id,week_start,action,note,visit_count,approved_minutes,created_by,created_at')
  .eq('profile_id',profile).eq('week_start',week).maybeSingle();
 if(eventError||!event||event.action!=='closed')return new Response('Only fully closed weeks can be exported.',{status:409,headers});
 try{
  const [entries,staff,reviewer,properties,units,areas]=await Promise.all([
   allRows<Entry>((a,b)=>db.from('mzs_ops_week_entries').select('visit_id,worked_on,property_id,unit_id,work_area_id,actual_minutes,approved_minutes,category,description',{count:'exact'}).eq('closure_id',event.id).order('worked_on').order('visit_id').range(a,b)),
   db.from('profiles').select('full_name').eq('id',profile).maybeSingle(),
   db.from('profiles').select('full_name').eq('id',event.created_by).maybeSingle(),
   allRows<{id:string;name:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
   allRows<{id:string;address:string}>((a,b)=>db.from('mzs_estate_units').select('id,address',{count:'exact'}).order('id').range(a,b)),
   allRows<{id:string;name:string}>((a,b)=>db.from('mzs_ops_staff_work_areas').select('id,name',{count:'exact'}).order('id').range(a,b))
  ]);
  if(staff.error||reviewer.error||!staff.data||!reviewer.data||
   entries.length!==event.visit_count||entries.length>1000||
   entries.reduce((n,r)=>n+r.approved_minutes,0)!==event.approved_minutes||
   entries.some(e=>!e.work_area_id&&!e.property_id||e.work_area_id&&e.property_id))
   return new Response('Snapshot incomplete. No partial export produced.',{status:409,headers});
  const names=new Map(properties.map(p=>[p.id,p.name])),places=new Map(areas.map(p=>[p.id,p.name])),unitNames=new Map(units.map(u=>[u.id,u.address]));
  const rows:FrozenVisit[]=entries.map(e=>({visit_id:e.visit_id,worked_on:e.worked_on,
   location:e.work_area_id?places.get(e.work_area_id)??'Unknown work area':names.get(e.property_id??'')??'Unknown property',
   unit:e.unit_id?unitNames.get(e.unit_id)??'Unknown unit':'',category:e.category,description:e.description,
   actual_minutes:e.actual_minutes,approved_minutes:e.approved_minutes}));
  const report:ClosedWeekReport={name:staff.data.full_name??'Staff member',week,closedAt:event.created_at,
   approvedBy:reviewer.data.full_name??'Group Administrator',closeNote:event.note,
   rows,totalMinutes:event.approved_minutes,eventId:event.id};
  const body=format==='pdf'?await weekPdf(report):weekWorkbook(report);
  const mime=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return new Response(new Uint8Array(body),{status:200,headers:{...headers,'Content-Type':mime,
   'Content-Disposition':'attachment; filename="MZS-Staff-Week-'+week+'.'+format+'"'}});
 }catch{return new Response('Week export unavailable. Please retry after refreshing.',{status:503,headers});}
}
