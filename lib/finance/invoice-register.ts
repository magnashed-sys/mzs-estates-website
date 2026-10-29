import {loadExternalReceipts,externalPaymentTotals,type ExternalReceipt} from './external-receipts';
import type {SupabaseClient} from '@supabase/supabase-js';
import {allRows} from '../property-operations/staff-data';
import {euroCents,dateYear} from '../property-operations/sales-reconciliation';
import {operationsDay} from '../property-operations/action-queues';
import {accountantCsv} from '../property-operations/finance';

export const invoiceSources={external:'Standalone',rental:'Rental contract',booking:'Booking',archive:'Imported'} as const;
export const invoiceStatuses={all:'All invoices',open:'Open / payment unknown',overdue:'Overdue',paid:'Paid',partial:'Partly paid',unpaid:'Unpaid',unknown:'Payment unknown',credit:'Credit notes / credit balances'} as const;
export type InvoiceSource=keyof typeof invoiceSources;
export type InvoiceFilters={year:number|null;q:string;entity:string;source:InvoiceSource|'all';status:keyof typeof invoiceStatuses;page:number};
export type InvoiceRow={id:string;source:InvoiceSource;issuerId:string;issuer:string;number:string;customer:string;subject:string;issuedOn:string;dueOn:string|null;gross:number;paid:number|null;balance:number|null;href:string;paymentBasis:'receipt_register'|'imported_snapshot'|'not_recorded'|'imported_plus_receipts';alsoImported:boolean};
type Common={id:string;issuer_id:string;number:string;issued_on:string};
export type RentalRow=Common&{due_date:string;total:unknown;customer:string;subject:string};
export type BookingRow=Common&{booking_id:string;total:unknown;customer:string};
export type ExternalRow=Common&{customer_id:string;customer_reference:string;due_on:string;gross_cents:number;net_cents:number;vat_cents:number;status:string;payment_status:string;currency:string};
export type ArchiveRow=Common&{customer_name:string;subject:string;due_on:string;gross_cents:number;source_paid_cents:number;source_open_cents:number};
export type Receipt={id:string;invoice_id?:string;booking_id?:string;amount:unknown;reversed_at:string|null};
export type InvoiceInputs={issuers:{id:string;name:string}[];customers:{id:string;name:string}[];rentals:RentalRow[];bookings:BookingRow[];external:ExternalRow[];archive:ArchiveRow[];rentReceipts:Receipt[];bookingReceipts:Receipt[];externalReceipts:ExternalReceipt[];archiveReceipts:ExternalReceipt[]};
const idPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const fail=():never=>{throw Error('The complete invoice register could not be verified. No partial totals are shown.');};
const cents=(n:unknown):n is number=>Number.isSafeInteger(n)&&Math.abs(Number(n))<=100000000000;
function date(v:string){if(typeof v!=='string'||dateYear(v)===null)fail();return v;}
function text(v:unknown){if(typeof v!=='string'||!v.trim())fail();return v as string;}
export function invoiceFilters(params:Record<string,string|string[]|undefined>,now=new Date()):InvoiceFilters{
 const get=(key:string,fallback='')=>{const v=params[key];if(v===undefined)return fallback;if(typeof v!=='string')throw Error('Invalid invoice filter');return v;};
 const year=get('year',operationsDay(now).slice(0,4)),q=get('q').trim(),source=get('source','all'),status=get('status','all'),page=get('page','1'),entity=get('entity','all');
 if((entity!=='all'&&!idPattern.test(entity))||(year!=='all'&&!/^20\d{2}$/.test(year))||q.length>150||(source!=='all'&&!Object.hasOwn(invoiceSources,source))||!Object.hasOwn(invoiceStatuses,status)||!/^\d{1,6}$/.test(page)||Number(page)<1)throw Error('Invalid invoice filter');
 return {year:year==='all'?null:Number(year),q,entity:entity.toLowerCase(),source:source as InvoiceFilters['source'],status:status as InvoiceFilters['status'],page:Number(page)};
}
export function invoiceHref(f:InvoiceFilters,page=1,csv=false){const q=new URLSearchParams({year:f.year===null?'all':String(f.year)});if(f.q)q.set('q',f.q);if(f.entity!=='all')q.set('entity',f.entity);if(f.source!=='all')q.set('source',f.source);if(f.status!=='all')q.set('status',f.status);if(!csv&&page>1)q.set('page',String(page));return '/admin/workspaces/accountancy/sales'+(csv?'/export':'')+'?'+q;}
/** All sources stay read-only. A source gap or conflicting duplicate fails closed. */
export function normalizeInvoiceRegister(input:InvoiceInputs):InvoiceRow[]{
 const issuers=new Map(input.issuers.map(x=>[x.id,text(x.name)])),customers=new Map(input.customers.map(x=>[x.id,text(x.name)]));
 if(issuers.size!==input.issuers.length||customers.size!==input.customers.length)fail();
 const receiptTotals=(receipts:Receipt[],key:'invoice_id'|'booking_id',targets:Set<string>)=>{
  const seen=new Set<string>(),totals=new Map<string,number>();
  for(const r of receipts){const target=r[key];if(!idPattern.test(r.id)||seen.has(r.id)||!target||!targets.has(target)||!(r.reversed_at===null||typeof r.reversed_at==='string'&&Number.isFinite(Date.parse(r.reversed_at))))fail();seen.add(r.id);const amount=euroCents(r.amount);if(amount<=0)fail();if(r.reversed_at===null){const total=(totals.get(target!)??0)+amount;if(!cents(total))fail();totals.set(target!,total);}}
  return totals;
 };
 const bookingIds=new Set(input.bookings.map(i=>i.booking_id));if(bookingIds.size!==input.bookings.length)fail();
 const rentPaid=receiptTotals(input.rentReceipts,'invoice_id',new Set(input.rentals.map(i=>i.id))),bookingPaid=receiptTotals(input.bookingReceipts,'booking_id',bookingIds);
 const result:InvoiceRow[]=[],byNumber=new Map<string,InvoiceRow>(),ids=new Set<string>();
 function add(source:InvoiceSource,i:Common,rest:Omit<InvoiceRow,'id'|'source'|'issuerId'|'issuer'|'number'|'issuedOn'|'alsoImported'>){
  if(!idPattern.test(i.id)||!idPattern.test(i.issuer_id)||!issuers.has(i.issuer_id)||ids.has(source+':'+i.id)||!cents(rest.gross)||!text(rest.customer)||(rest.paid!==null&&!cents(rest.paid))||(rest.balance!==null&&!cents(rest.balance))||(rest.paid===null)!==(rest.balance===null)||(rest.paid!==null&&rest.paid+rest.balance! !==rest.gross))fail();
  ids.add(source+':'+i.id);date(i.issued_on);if(rest.dueOn)date(rest.dueOn);
  const key=i.issuer_id+':'+text(i.number).trim().toUpperCase(),existing=byNumber.get(key);
  if(existing){
   // Identical imported copies never inflate totals; live receipt data takes precedence.
   if(source!=='archive'||existing.source==='archive'||existing.gross!==rest.gross||existing.issuedOn!==i.issued_on)fail();
   existing.alsoImported=true;return;
  }
  const row={id:i.id,source,issuerId:i.issuer_id,issuer:issuers.get(i.issuer_id)!,number:i.number,issuedOn:i.issued_on,alsoImported:false,...rest};byNumber.set(key,row);result.push(row);
 }
 for(const i of input.rentals){const gross=euroCents(i.total),paid=rentPaid.get(i.id)??0;add('rental',i,{customer:i.customer,subject:i.subject??'',dueOn:i.due_date,gross,paid,balance:gross-paid,href:'/admin/group/estates/contracts?view=billing',paymentBasis:'receipt_register'});}
 for(const i of input.bookings){if(!idPattern.test(i.booking_id))fail();const gross=euroCents(i.total),paid=bookingPaid.get(i.booking_id)??0;add('booking',i,{customer:i.customer,subject:'Booking invoice',dueOn:null,gross,paid,balance:gross-paid,href:'/admin/bookings/'+i.booking_id,paymentBasis:'receipt_register'});}
 if(!Array.isArray(input.externalReceipts)||input.externalReceipts.some(r=>!input.external.some(i=>i.id===r.invoice_id)))fail();
 for(const i of input.external){if(i.currency!=='EUR'||i.status!=='externally_issued'||i.payment_status!=='not_recorded'||![i.net_cents,i.vat_cents,i.gross_cents].every(cents)||i.net_cents+i.vat_cents!==i.gross_cents||!customers.has(i.customer_id))fail();const payment=externalPaymentTotals(input.externalReceipts,i.id,i.gross_cents);add('external',i,{customer:customers.get(i.customer_id)!,subject:i.customer_reference,dueOn:i.due_on,gross:i.gross_cents,paid:payment.paid,balance:payment.balance,href:'/admin/workspaces/accountancy/sales/standalone/'+i.id,paymentBasis:payment.activeCount?'receipt_register':'not_recorded'});}
 if(!Array.isArray(input.archiveReceipts)||input.archiveReceipts.some(r=>!input.archive.some(i=>i.id===r.invoice_id)))fail();
 for(const i of input.archive){const payments=input.archiveReceipts.filter(r=>r.invoice_id===i.id);const added=payments.length?externalPaymentTotals(payments,i.id,Math.max(1,i.source_open_cents)).paid??0:0;if(added>Math.max(0,i.source_open_cents))fail();add('archive',i,{customer:i.customer_name,subject:i.subject,dueOn:i.due_on,gross:i.gross_cents,paid:i.source_paid_cents+added,balance:i.source_open_cents-added,href:'/admin/workspaces/accountancy/sales/imported/'+i.id,paymentBasis:added?'imported_plus_receipts':'imported_snapshot'});}
 return result.sort((a,b)=>b.issuedOn.localeCompare(a.issuedOn)||a.number.localeCompare(b.number,undefined,{numeric:true})||a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
}
export function invoiceStatus(i:InvoiceRow,today:string){if(i.gross<0)return 'Credit note';if(i.balance===null)return 'Payment unknown';if(i.balance<0)return 'Credit balance';if(i.balance===0)return i.gross===0?'No charge':'Paid';if(i.dueOn&&i.dueOn<today)return 'Overdue';return i.paid!>0?'Partly paid':'Open';}
export function selectInvoices(all:InvoiceRow[],f:InvoiceFilters,today:string){
 const query=f.q.toLocaleLowerCase('en');
 const rows=all.filter(i=>(f.entity==='all'||i.issuerId===f.entity)&&(f.year===null||i.issuedOn.startsWith(String(f.year)))&&(f.source==='all'||i.source===f.source)&&(!query||[i.number,i.customer,i.issuer,i.subject].some(v=>v.toLocaleLowerCase('en').includes(query)))&&(f.status==='all'||f.status==='partial'&&i.paid!==null&&i.paid>0&&i.balance!==null&&i.balance>0||f.status==='unpaid'&&i.paid===0&&i.balance!==null&&i.balance>0||f.status==='unknown'&&i.balance===null||f.status==='open'&&(i.balance===null||i.balance>0)||f.status==='overdue'&&i.balance!==null&&i.balance>0&&!!i.dueOn&&i.dueOn<today||f.status==='paid'&&i.balance===0&&i.gross>=0||f.status==='credit'&&(i.gross<0||i.balance!==null&&i.balance<0)));
 const totals={count:rows.length,gross:0,paid:0,outstanding:0,overdue:0,unknown:0,unknownGross:0,credits:0};
 for(const i of rows){totals.gross+=i.gross;totals.paid+=i.paid??0;if(i.balance===null){totals.unknown++;totals.unknownGross+=i.gross;}else{totals.outstanding+=Math.max(0,i.balance);totals.credits+=Math.max(0,-i.balance);if(i.dueOn&&i.dueOn<today)totals.overdue+=Math.max(0,i.balance);}}
 if(!Object.values(totals).every(Number.isSafeInteger))fail();return {rows,totals};
}
/** Exact-count pagination prevents the Data API row cap from becoming a financial total. */
export async function loadInvoiceRegister(db:SupabaseClient,year:number|null):Promise<InvoiceRow[]>{
 const read=<T,>(table:string,columns:string,dated=false)=>allRows<T>((a,b)=>{let q=db.from(table).select(columns,{count:'exact'});if(dated&&year!==null)q=q.gte('issued_on',year+'-01-01').lt('issued_on',(year+1)+'-01-01');return q.order('id').range(a,b) as unknown as PromiseLike<{data:T[]|null;error:unknown;count:number|null}>;});
 const [issuers,customers,rentals,bookings,external,archive]=await Promise.all([
  read<InvoiceInputs['issuers'][number]>('mzs_lease_issuers','id,name'),read<InvoiceInputs['customers'][number]>('mzs_lease_relationships','id,name'),
  read<RentalRow>('mzs_lease_invoices','id,issuer_id,number,issued_on,due_date,total,customer:payload->snapshot->>tenant_name,subject:payload->>subject',true),
  read<BookingRow>('mzs_booking_invoices','id,issuer_id,number,issued_on,booking_id,total,customer:payload->>recipient_name',true),
  read<ExternalRow>('mzs_ops_external_sales_invoices','id,issuer_id,number,issued_on,customer_id,customer_reference,due_on,net_cents,vat_cents,gross_cents,currency,status,payment_status',true),
  read<ArchiveRow>('mzs_invoice_archive_active','id,issuer_id,number,issued_on,customer_name,subject,due_on,gross_cents,source_paid_cents,source_open_cents',true)
 ]);
 async function receipts(table:string,key:'invoice_id'|'booking_id',ids:string[]){const rows:Receipt[]=[];for(let start=0;start<ids.length;start+=100){const group=ids.slice(start,start+100);rows.push(...await allRows<Receipt>((a,b)=>db.from(table).select('id,'+key+',amount,reversed_at',{count:'exact'}).in(key,group).order('id').range(a,b) as unknown as PromiseLike<{data:Receipt[]|null;error:unknown;count:number|null}>));}return rows;}
 const [rentReceipts,bookingReceipts,externalReceipts,archiveReceipts]=await Promise.all([receipts('mzs_lease_payments','invoice_id',rentals.map(i=>i.id)),receipts('mzs_booking_receipts','booking_id',bookings.map(i=>i.booking_id)),loadExternalReceipts(db,external.map(i=>i.id)),loadExternalReceipts(db,archive.map(i=>i.id),'archive')]);
 return normalizeInvoiceRegister({issuers,customers,rentals,bookings,external,archive,rentReceipts,bookingReceipts,externalReceipts,archiveReceipts});
}
export function invoiceRegisterCsv(rows:InvoiceRow[],today:string){return accountantCsv(['source','invoice_number','issuer','customer','subject','issued_on','due_on','gross_cents','recorded_paid_cents','balance_cents','status','payment_basis','also_imported','currency'],rows.map(i=>({source:i.source,invoice_number:i.number,issuer:i.issuer,customer:i.customer,subject:i.subject,issued_on:i.issuedOn,due_on:i.dueOn??'',gross_cents:i.gross,recorded_paid_cents:i.paid??'',balance_cents:i.balance??'',status:invoiceStatus(i,today),payment_basis:i.paymentBasis,also_imported:i.alsoImported,currency:'EUR'})));}
