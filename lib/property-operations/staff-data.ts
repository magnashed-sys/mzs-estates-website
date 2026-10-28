import type {createClient} from '../supabase/server';
import {uuid,pageNumber,type Visit,type Ticket,type Correction,type Decision} from './staff-work';
export type Params=Record<string,string|string[]|undefined>;
export const one=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;
type DB=Awaited<ReturnType<typeof createClient>>;
export async function allRows<T>(fetchPage:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown;count:number|null}>):Promise<T[]>{
 const rows:T[]=[];let total:number|null=null;
 for(let offset=0;offset<10000;offset+=500){
  const r=await fetchPage(offset,offset+499);
  if(r.error||!r.data||r.count===null||(total!==null&&total!==r.count))throw Error('Gegevens konden niet volledig worden geladen. Vernieuw de pagina.');
  total=r.count;rows.push(...r.data);
  if(rows.length===total)return rows;
  if(!r.data.length)break;
 }
 throw Error('Dit overzicht is te groot om volledig te laden. Neem contact op met de beheerder.');
}
export async function loadRegisters(db:DB,params:Params,admin=false){
 const requestedProperty=one(params.property),property=requestedProperty&&uuid.test(requestedProperty)?requestedProperty:undefined;
 async function page(table:string,pageKey:string,sort:string){
  let number=pageNumber(one(params[pageKey]));
  const query=()=>{let q=db.from(table).select('*',{count:'exact'});if(property)q=q.eq('property_id',property);return q.order(sort,{ascending:false}).order('id');};
  let result=await query().range((number-1)*25,number*25-1);
  if((result.error?.code==='PGRST103')||(!result.error&&result.count!==null&&(number-1)*25>=result.count&&number>1)){number=1;result=await query().range(0,24);}
  if(result.error||!result.data||result.count===null)throw Error('Het register kon niet worden geladen. Vernieuw de pagina.');
  return {rows:result.data,total:result.count,page:number};
 }
 const [visits,tickets]=await Promise.all([page('mzs_ops_current_visits','vpage','worked_on'),page('mzs_ops_current_tickets','tpage','created_at')]);
 const visitId=one(params.visit),ticketId=one(params.ticket);
 const [visit,ticket]=await Promise.all([
  visitId&&uuid.test(visitId)?db.from('mzs_ops_current_visits').select('*').eq('id',visitId).maybeSingle():Promise.resolve({data:null,error:null}),
  ticketId&&uuid.test(ticketId)?db.from('mzs_ops_current_tickets').select('*').eq('id',ticketId).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if(visit.error||ticket.error)throw Error('Detail kon niet worden geladen.');
 const [corrections,reviews,events]=await Promise.all([
  visit.data?allRows<Correction>((a,b)=>db.from('mzs_ops_visit_correction_requests').select('id,visit_id,proposed_minutes,reason,created_at',{count:'exact'}).eq('visit_id',visit.data.id).order('sequence_no',{ascending:false}).range(a,b)):Promise.resolve([]),
  visit.data?allRows<{id:string;decision:string;reason:string;reviewed_minutes:number;reviewed_at:string;billable_minutes?:number;reviewed_by?:string}>((a,b)=>db.from(admin?'mzs_ops_visit_reviews':'mzs_ops_staff_review_status').select('*',{count:'exact'}).eq('visit_id',visit.data.id).order('reviewed_at',{ascending:false}).order('id').range(a,b)):Promise.resolve([]),
  ticket.data?allRows<{id:string;action:string;note:string;scheduled_for:string|null;created_at:string}>((a,b)=>db.from('mzs_ops_maintenance_events').select('id,action,note,scheduled_for,created_at',{count:'exact'}).eq('ticket_id',ticket.data.id).order('sequence_no',{ascending:false}).range(a,b)):Promise.resolve([])
 ]);
 const decisions:Decision[]=[];
 for(let i=0;i<corrections.length;i+=100){const ids=corrections.slice(i,i+100).map(c=>c.id);decisions.push(...await allRows<Decision>((a,b)=>db.from('mzs_ops_visit_correction_decisions').select('correction_id,decision,reason',{count:'exact'}).in('correction_id',ids).order('id').range(a,b)));}
 const photos=ticket.data?await allRows<{id:string;created_at:string}>((a,b)=>db.from('mzs_ops_maintenance_photos').select('id,created_at',{count:'exact'}).eq('ticket_id',ticket.data.id).order('created_at').order('id').range(a,b)):[];
 const holds=admin&&photos.length?await allRows<{photo_id:string}>((a,b)=>db.from('mzs_ops_maintenance_photo_holds').select('photo_id',{count:'exact'}).in('photo_id',photos.map(p=>p.id)).order('id').range(a,b)):[];
 return {property,visits:{...visits,rows:visits.rows as Visit[]},tickets:{...tickets,rows:tickets.rows as Ticket[]},visit:visit.data as Visit|null,ticket:ticket.data as Ticket|null,corrections,decisions,reviews,events,photos:photos.map(p=>({...p,held:holds.some(h=>h.photo_id===p.id)}))};
}
