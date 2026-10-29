import type {SupabaseClient} from '@supabase/supabase-js';
import {dateYear} from '../property-operations/sales-reconciliation';
export type ExternalReceipt={id:string;invoice_id:string;amount_cents:number;received_on:string;reference:string;recorded_by:string;created_at:string;reversed_at:string|null;reversed_by:string|null;reversal_reason:string|null};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function externalPaymentTotals(rows:ExternalReceipt[],invoiceId:string,gross:number){
 const seen=new Set<string>();let paid=0,count=0;
 for(const r of rows){
  if(r.invoice_id!==invoiceId)continue;
  if(!uuid.test(r.id)||seen.has(r.id)||!uuid.test(r.recorded_by)||!Number.isSafeInteger(r.amount_cents)||r.amount_cents<=0||r.amount_cents>100000000000||!Number.isFinite(Date.parse(r.created_at))||!r.received_on||dateYear(r.received_on)===null||typeof r.reference!=='string'||r.reference.length<3)throw Error('Invalid standalone payment history');
  seen.add(r.id);
  if(r.reversed_at===null){if(r.reversed_by!==null||r.reversal_reason!==null)throw Error('Incomplete payment reversal');paid+=r.amount_cents;count++;}
  else if(!Number.isFinite(Date.parse(r.reversed_at))||!r.reversed_by||!uuid.test(r.reversed_by)||!r.reversal_reason||r.reversal_reason.length<8)throw Error('Incomplete payment reversal');
 }
 if(!Number.isSafeInteger(gross)||gross<=0||!Number.isSafeInteger(paid)||paid>gross)throw Error('Standalone payments exceed invoice amount');
 // No active evidence (including after all reversals) restores the unknown state.
 return {paid:count?paid:null,balance:count?gross-paid:null,activeCount:count};
}
export async function loadExternalReceipts(db:SupabaseClient,invoiceIds:string[],source:'external'|'archive'|'service'='external'):Promise<ExternalReceipt[]>{
 if(new Set(invoiceIds).size!==invoiceIds.length||invoiceIds.some(id=>!uuid.test(id)))throw Error('Invalid invoice selection');
 const rows:ExternalReceipt[]=[];
 for(let start=0;start<invoiceIds.length;start+=100){
  const ids=invoiceIds.slice(start,start+100),{data,error}=await db.rpc(source==='service'?'mzs_service_invoice_receipt_source':source==='archive'?'mzs_archive_invoice_receipt_source':'mzs_external_invoice_receipt_source',{p_invoice_ids:ids});
  if(error||!data||!Array.isArray(data.invoice_ids)||data.invoice_ids.length!==ids.length||new Set(data.invoice_ids).size!==ids.length||data.invoice_ids.some((id:unknown)=>typeof id!=='string'||!ids.includes(id))||!Array.isArray(data.rows)||!Number.isSafeInteger(data.count)||data.count<0||data.count>10000||data.rows.length!==data.count||new Set(data.rows.map((r:ExternalReceipt)=>r.id)).size!==data.count||data.rows.some((r:ExternalReceipt)=>!ids.includes(r.invoice_id)))throw Error('Complete standalone payment history unavailable');
  rows.push(...data.rows);
 }
 return rows;
}
