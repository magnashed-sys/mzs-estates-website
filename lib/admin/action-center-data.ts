import type {SupabaseClient} from '@supabase/supabase-js';
import {allRows} from '../property-operations/staff-data';
import {loadInvoiceRegister} from '../finance/invoice-register';
import {annualSource} from '../accountancy/administration-data';
import {bankSource} from '../accountancy/bank/data';
import {monthCloseReadiness} from '../accountancy/month-close-readiness';
import {completenessItems} from '../accountancy/completeness';
import {purchaseReviewItems} from '../accountancy/purchase-review';
import type {SupplierIdentity} from '../accountancy/supplier-integrity';
import type {Year} from '../accountancy/administration';
import type {CrmActivity} from '../relationships/crm-activities';
import {loadQueueCounts,queueHref} from '../property-operations/action-queues';
import {staffEnvironmentAvailable} from '../security/property-staff';
import {checkedActions,crmActions,invoiceActions,purchaseActions,verifiedDate,type ActionCategory,type DailyAction,type ActionSnapshot} from './action-center';

/** Caller must already pass requireEstateAdmin. Reads use that user's client/RLS;
 * no privileged service client, new permissions or financial mutations. */
export async function loadActionCenter(db:SupabaseClient,today:string,includeMonths=true):Promise<ActionSnapshot>{
 verifiedDate(today);
 const snapshot:ActionSnapshot={today,items:[],failures:[],months:[]};
 const failed=(source:string,category:ActionCategory|'month')=>{snapshot.failures.push({source,category});};
 async function read<T>(table:string,columns:string,filter:(q:any)=>any=q=>q):Promise<T[]>{
  return allRows<T>((a,b)=>filter(db.from(table).select(columns,{count:'exact'})).order('id').range(a,b));
 }
 async function rpcPage<T>(query:PromiseLike<{data:unknown;error:unknown;count:number|null}>){
  const result=await query;
  return {...result,data:Array.isArray(result.data)?result.data as T[]:null};
 }
 async function source(name:string,category:ActionCategory,load:()=>Promise<DailyAction[]>){
  try{snapshot.items.push(...checkedActions(await load()));}catch{failed(name,category);}
 }
 // Shared promises stay inside the request and resolve failures explicitly.
 const invoices=loadInvoiceRegister(db,null).catch(()=>null);
 const suppliers=read<SupplierIdentity>('mzs_lease_relationships','id,name,kind,company_details').catch(()=>null);
 const year=Number(today.slice(0,4)),month=today.slice(0,7);
 await Promise.all([
  source('invoices','invoices',async()=>{const rows=await invoices;if(!rows)throw Error('Unavailable invoices');return invoiceActions(rows,today);}),
  source('crm','crm',async()=>{
   const [rows,contacts]=await Promise.all([read<CrmActivity>('mzs_crm_activities','id,relationship_id,kind,title,due_on,status',q=>q.eq('kind','task').eq('status','open')),suppliers]);
   if(!contacts)throw Error('Unavailable relationships');
   return crmActions(rows,new Map(contacts.map(r=>[r.id,r.name])),today);
  }),
  source('owner_stays','requests',async()=>{
   const rows=await read<{id:string;check_in:string;check_out:string}>('mzs_owner_stay_requests','id,check_in,check_out',q=>q.eq('status','requested'));
   return rows.map(r=>({id:'owner:'+r.id,category:'requests',priority:'review',title:'owner_stay',detail:r.check_in+' – '+r.check_out,
    href:'/admin/owner-stays#request-'+r.id,dueOn:null,count:1,kind:'record'}));
  }),
  source('bookings','requests',async()=>{
   const rows=await allRows<{id:string;check_in:string;check_out:string}>((a,b)=>rpcPage(db.rpc('admin_list_rental_bookings',{}, {count:'exact'})
    .select('id,check_in,check_out').eq('status','requested').eq('is_test',false).order('id').range(a,b)));
   return rows.map(r=>({id:'booking:'+r.id,category:'requests',priority:'review',title:'booking_request',detail:r.check_in+' – '+r.check_out,
    href:'/admin/bookings/'+r.id,dueOn:null,count:1,kind:'record'}));
  }),
  source('capital','requests',async()=>{
   const rows=await allRows<{id:string;member_name:string|null;status:string}>((a,b)=>rpcPage(db.rpc('mzs_capital_admin_list_requests',{}, {count:'exact'})
    .select('id,member_name,status').order('id').range(a,b)));
   // The scoped legacy RPC caps its result at 300 before caller filters.
   // Saturation cannot establish completeness, even with an exact result count.
   if(rows.length>=300)throw Error('Capital request source capped');
   return rows.filter(r=>r.status==='new'||r.status==='pending').map(r=>({id:'capital:'+r.id,category:'requests',priority:'review',title:'capital_request',detail:r.member_name??'',
    href:'/admin/capital-requests#request-'+r.id,dueOn:null,count:1,kind:'record'}));
  }),
  source('email','system',async()=>{
   const rows=await read<{id:string}>('mzs_mail_outbox','id',q=>q.eq('status','failed'));
   return rows.length?[{id:'email:failed',category:'system',priority:'review',title:'failed_email',detail:'',
    href:'/admin/accounts#notification-settings',dueOn:null,count:rows.length,kind:'queue'}]:[];
  }),
  source('operations','operations',async()=>{
   if(!staffEnvironmentAvailable())throw Error('Unavailable property operations');
   const queues=await loadQueueCounts(db as Parameters<typeof loadQueueCounts>[0],today);
   if(queues.some(q=>q.count===null))failed('operations','operations');
   return queues.filter(q=>q.count!==null&&q.count>0).map(q=>({id:'operations:'+q.key,category:'operations',
    priority:q.key==='overdue'?'overdue':q.key==='today'?'today':'review',title:'operations_'+q.key,detail:'',
    href:queueHref(q.key),dueOn:null,count:q.count!,kind:'queue'}));
  }),
  (async()=>{
   let years:Year[],entities:{id:string;name:string}[];
   try{
    [years,entities]=await Promise.all([
     read<Year>('mzs_accountancy_years','id,issuer_id,fiscal_year,purpose',q=>q.eq('purpose','current').eq('fiscal_year',year)),
     read<{id:string;name:string}>('mzs_lease_issuers','id,name')]);
    if(years.length>30||new Set(years.map(y=>y.issuer_id)).size!==years.length)throw Error('Unverified annual scope');
   }catch{failed('administrations','purchases');if(includeMonths)failed('administrations','month');return;}
   const contacts=await suppliers;
   // Bounded concurrency, without dropping any registered administration.
   for(let start=0;start<years.length;start+=3)await Promise.all(years.slice(start,start+3).map(async y=>{
    const entity=entities.find(e=>e.id===y.issuer_id)?.name;
    const href='/admin/workspaces/accountancy/month-close?administration='+y.id+'&month='+month.slice(5);
    let annual:Awaited<ReturnType<typeof annualSource>>;
    try{if(!entity)throw Error('Unknown issuer');annual=await annualSource(db,y.id);
     if(annual.administration.issuer_id!==y.issuer_id||annual.administration.fiscal_year!==year)throw Error('Annual scope changed');
    }catch{failed(entity??'administrations','purchases');if(includeMonths){failed(entity??'administrations','month');snapshot.months.push({id:y.id,entity:entity??'Unknown entity',href,report:null});}return;}
    try{if(!contacts)throw Error('Unavailable suppliers');snapshot.items.push(...purchaseActions(purchaseReviewItems(completenessItems(annual,contacts)),y.id,entity!));}
    catch{failed(entity!,'purchases');}
    if(includeMonths){
     let report:null|ReturnType<typeof monthCloseReadiness>=null;
     try{
      const rows=await invoices;if(!rows)throw Error('Unavailable invoice source');
      const bank=await bankSource(db,y.id).catch(()=>null);
      report=monthCloseReadiness(annual,rows,month,today,bank);
     }catch{failed(entity!,'month');}
     snapshot.months.push({id:y.id,entity:entity!,href,report});
    }
   }));
  })()
 ]);
 snapshot.months.sort((a,b)=>a.entity.localeCompare(b.entity)||a.id.localeCompare(b.id));
 return snapshot;
}
