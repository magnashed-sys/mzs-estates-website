import type {createClient} from '../supabase/server';
import {uuid,pageNumber} from './staff-work';
import {operationsDay} from './action-queues';
import {dateYear} from './sales-reconciliation';
import {normalizedCostLocation} from './weekly-import';
import {accountantCsv} from './finance';
export type HistoryFilters={year:number;profile:string;page:number};
export type HistoryBatch={id:string;profile_id:string;person_name:string|null;reporting_year:number;source_name:string;source_file_id:string;source_sha256:string;hash_basis:string;expected_rows:number;expected_cost_cents:number;created_at:string};
export type ExternalInvoice={id:string;batch_id:string;issuer_id:string;customer_id:string;property_id:string;issuer_name:string;customer_name:string;property_name:string;number:string;issued_on:string;due_on:string;period_from:string;period_until:string;customer_reference:string;net_cents:number;vat_cents:number;gross_cents:number;vat_basis_points:number;billed_hours:number;hourly_rate_cents:number;currency:string;status:string;delivery_status:string;payment_status:string;source_file_id:string;source_name:string};
export type HistoryRow={id:string;batch_id:string;profile_id:string;reporting_year:number;reference:string;iso_week:number;period_from:string;period_until:string;original_location:string;category:string;description:string;cost_cents:number;recharge:'Ja'|'Nee'|'Te beoordelen';source_reference:string;source_check:string;source_billing_reference:string;invoice_id:string|null;billed_hours:number|null;recharge_cents:number|null};
export type HistoryReport={snapshotAt:string;filters:HistoryFilters;batches:HistoryBatch[];rows:HistoryRow[];invoices:ExternalInvoice[];totalCost:number;rechargedCost:number;billedHours:number;reviewCount:number;notRechargeCount:number;groups:{location:string;count:number;cost:number;invoiced:number}[]};
export function historyFilters(params:Record<string,string|string[]|undefined>,now=new Date()):HistoryFilters{
 const read=(key:string,fallback='')=>{const v=params[key];if(typeof v==='string')return v;if(v===undefined)return fallback;throw Error('Ongeldig historisch filter');};
 const year=read('year',operationsDay(now).slice(0,4)),profile=read('profile');
 if(!/^20\d{2}$/.test(year)||(profile&&!uuid.test(profile)))throw Error('Kies een geldig jaar en account.');
 return {year:Number(year),profile:profile.toLowerCase(),page:pageNumber(read('page','1'))};
}
export function historyHref(f:HistoryFilters,page=1,csv=false){const q=new URLSearchParams({year:String(f.year)});if(f.profile)q.set('profile',f.profile);if(!csv)q.set('page',String(pageNumber(String(page))));return '/admin/workspaces/estates/history'+(csv?'/export':'')+'?'+q;}
export function librarySourceHref(id:string){if(!/^libfile[_-][A-Za-z0-9_-]+$/.test(id))throw Error('Ongeldige bronverwijzing');return 'https://chatgpt.com/library?file_id='+encodeURIComponent(id)+'&account_id=personal';}
const validId=(v:unknown):v is string=>typeof v==='string'&&uuid.test(v);
const cents=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=100000000000;
const date=(s:unknown):s is string=>{if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;try{dateYear(s);return true;}catch{return false;}};
const text=(s:unknown,max:number,min=0):s is string=>typeof s==='string'&&s.length>=min&&s.length<=max;
export function normalizeHistory(source:unknown,filters:HistoryFilters):HistoryReport{
 const fail=()=>{throw Error('Historische bron onvolledig of inconsistent. Er zijn geen gedeeltelijke totalen weergegeven.');};
 if(!source||typeof source!=='object')return fail();const s=source as Record<string,unknown>;
 if(s.year!==filters.year||s.profile!==(filters.profile||null)||typeof s.snapshot_at!=='string'||!Number.isFinite(Date.parse(s.snapshot_at))||!Array.isArray(s.batches)||s.batches.length>1000||!Array.isArray(s.rows)||s.rows.length>10000||!Array.isArray(s.invoices)||s.invoices.length>1000)return fail();
 const batches=s.batches as HistoryBatch[],rows=s.rows as HistoryRow[],invoices=s.invoices as ExternalInvoice[];
 const bm=new Map<string,HistoryBatch>(),im=new Map<string,ExternalInvoice>();
 for(const b of batches){
  if(!b||!validId(b.id)||bm.has(b.id)||!validId(b.profile_id)||b.reporting_year!==filters.year||(filters.profile&&b.profile_id!==filters.profile)||!Number.isInteger(b.expected_rows)||b.expected_rows<1||b.expected_rows>5000||!cents(b.expected_cost_cents)||!text(b.source_name,240,1)||!text(b.source_file_id,150,8)||!/^libfile[_-][A-Za-z0-9_-]+$/.test(b.source_file_id)||!text(b.source_sha256,64,64)||!/^[0-9a-f]{64}$/.test(b.source_sha256)||b.hash_basis!=='extracted_csv_utf8_lf'||(b.person_name!==null&&!text(b.person_name,500)))return fail();
  bm.set(b.id,b);
 }
 const numbers=new Set<string>();
 for(const i of invoices){
  if(!i||!validId(i.id)||im.has(i.id)||!bm.has(i.batch_id)||![i.issuer_id,i.customer_id,i.property_id].every(validId)||!text(i.number,100,1)||i.number.trim()!==i.number||numbers.has(i.issuer_id+':'+i.number.toUpperCase())||!date(i.issued_on)||!date(i.due_on)||i.due_on<i.issued_on||!date(i.period_from)||!date(i.period_until)||i.period_until<i.period_from||![i.net_cents,i.vat_cents,i.gross_cents,i.hourly_rate_cents].every(cents)||i.net_cents<1||i.hourly_rate_cents<1||i.gross_cents!==i.net_cents+i.vat_cents||!Number.isInteger(i.vat_basis_points)||i.vat_basis_points<0||i.vat_basis_points>10000||Math.round(i.net_cents*i.vat_basis_points/10000)!==i.vat_cents||!Number.isInteger(i.billed_hours)||i.billed_hours<1||i.billed_hours>500000||i.billed_hours*i.hourly_rate_cents!==i.net_cents||i.currency!=='EUR'||i.status!=='externally_issued'||i.delivery_status!=='not_recorded'||i.payment_status!=='not_recorded'||![i.issuer_name,i.customer_name,i.property_name,i.customer_reference,i.source_name].every(v=>text(v,500,1))||!text(i.source_file_id,150,8)||!/^libfile[_-][A-Za-z0-9_-]+$/.test(i.source_file_id))return fail();
  numbers.add(i.issuer_id+':'+i.number.toUpperCase());im.set(i.id,i);
 }
 const seen=new Set<string>(),references=new Set<string>(),bt=new Map<string,{count:number;cost:number}>(),it=new Map<string,{hours:number;net:number}>(),groups=new Map<string,{location:string;count:number;cost:number;invoiced:number}>();
 let totalCost=0,rechargedCost=0,billedHours=0,reviewCount=0,notRechargeCount=0;
 for(const r of rows){
  const b=r&&bm.get(r.batch_id),key=r?.profile_id+':'+r?.reference;
  if(!r||!b||!validId(r.id)||seen.has(r.id)||references.has(key)||r.profile_id!==b.profile_id||r.reporting_year!==filters.year||!text(r.reference,60,3)||!/^[A-Za-z0-9_-]+$/.test(r.reference)||!date(r.period_from)||!date(r.period_until)||dateYear(r.period_from)!==filters.year||r.period_until<r.period_from||Date.parse(r.period_until)-Date.parse(r.period_from)>6*86400000||!Number.isInteger(r.iso_week)||r.iso_week<1||r.iso_week>53||!text(r.original_location,180,1)||!text(r.category,140,1)||!text(r.description,500,1)||!cents(r.cost_cents)||!['Ja','Nee','Te beoordelen'].includes(r.recharge)||!text(r.source_reference,150)||!text(r.source_check,500)||!text(r.source_billing_reference,120))return fail();
  seen.add(r.id);references.add(key);
  if(r.invoice_id===null){if(r.billed_hours!==null||r.recharge_cents!==null||r.source_billing_reference!=='')return fail();}
  else{const invoice=im.get(r.invoice_id);if(!invoice||invoice.batch_id!==r.batch_id||r.recharge!=='Ja'||!r.source_billing_reference||!Number.isInteger(r.billed_hours)||r.billed_hours!<1||r.billed_hours!>100||!cents(r.recharge_cents)||r.recharge_cents!==r.billed_hours!*invoice.hourly_rate_cents||r.period_from<invoice.period_from||r.period_until>invoice.period_until)return fail();const t=it.get(invoice.id)??{hours:0,net:0};t.hours+=r.billed_hours!;t.net+=r.recharge_cents;it.set(invoice.id,t);rechargedCost+=r.cost_cents;billedHours+=r.billed_hours!;}
  totalCost+=r.cost_cents;if(r.recharge==='Te beoordelen')reviewCount++;if(r.recharge==='Nee')notRechargeCount++;
  const t=bt.get(b.id)??{count:0,cost:0};t.count++;t.cost+=r.cost_cents;bt.set(b.id,t);
  const location=normalizedCostLocation(r.original_location),g=groups.get(location)??{location,count:0,cost:0,invoiced:0};g.count++;g.cost+=r.cost_cents;g.invoiced+=r.recharge_cents??0;groups.set(location,g);
 }
 for(const b of batches){const t=bt.get(b.id);if(!t||t.count!==b.expected_rows||t.cost!==b.expected_cost_cents)return fail();}
 for(const i of invoices){const t=it.get(i.id);if(!t||t.net!==i.net_cents||t.hours!==i.billed_hours)return fail();}
 return {snapshotAt:s.snapshot_at,filters,batches,rows,invoices,totalCost,rechargedCost,billedHours,reviewCount,notRechargeCount,groups:[...groups.values()].sort((a,b)=>a.location.localeCompare(b.location,'nl'))};
}
export async function loadHistory(db:Awaited<ReturnType<typeof createClient>>,filters:HistoryFilters){const {data,error}=await db.rpc('mzs_ops_historical_source',{p_year:filters.year,p_profile:filters.profile||null});if(error)throw Error('Historische opgaven konden niet volledig worden geladen.');return normalizeHistory(data,filters);}
export function historyCsv(report:HistoryReport){
 const batches=new Map(report.batches.map(x=>[x.id,x])),invoices=new Map(report.invoices.map(x=>[x.id,x]));
 const columns=['snapshot_at','profile_id','employee','source_reference','week_from','week_until','original_location','category','description','original_cost_cents','source_message','source_check','recharge','external_invoice_id','invoice_number','invoice_status','billed_hours','billed_net_cents','actual_minutes','time_note','payment_status','source_file_id','source_sha256'];
 return accountantCsv(columns,report.rows.map(r=>{const b=batches.get(r.batch_id)!,i=r.invoice_id?invoices.get(r.invoice_id):null;return {snapshot_at:report.snapshotAt,profile_id:r.profile_id,employee:b.person_name??'',source_reference:r.reference,week_from:r.period_from,week_until:r.period_until,original_location:r.original_location,category:r.category,description:r.description,original_cost_cents:r.cost_cents,source_message:r.source_reference,source_check:r.source_check,recharge:r.recharge,external_invoice_id:r.invoice_id,invoice_number:i?.number??'',invoice_status:i?.status??'',billed_hours:r.billed_hours,billed_net_cents:r.recharge_cents,actual_minutes:'',time_note:'Weekly cost statement; billed hours are not actual worked minutes',payment_status:'not_recorded',source_file_id:b.source_file_id,source_sha256:b.source_sha256};}));
}
