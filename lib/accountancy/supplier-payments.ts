import type {SupabaseClient} from '@supabase/supabase-js';

const STAGING='https://senonkpxdtlhyhrubicg.supabase.co';
const PRODUCTION='https://ptrnjzmcehrhbsfxntgw.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Independent review modes: Staging UAT money is always fictitious.
 * Real payment evidence can be entered only after a separate, explicit Production flag.
 * The flag must NEVER be included in standard/default Vercel environments.
 */
export type SupplierPaymentMode='synthetic'|'real';
export function supplierPaymentMode(env:NodeJS.ProcessEnv=process.env):SupplierPaymentMode|null{
 if(env.VERCEL_ENV==='preview'&&env.NEXT_PUBLIC_SUPABASE_URL===STAGING&&
  env.MZS_SUPPLIER_PAYMENTS_ENABLED==='true')return 'synthetic';
 if(env.VERCEL_ENV==='production'&&env.NEXT_PUBLIC_SUPABASE_URL===PRODUCTION&&
  env.MZS_SUPPLIER_PAYMENTS_REAL_ENABLED==='true'&&
  env.MZS_SUPPLIER_PAYMENTS_ENABLED!=='true')return 'real';
 return null;
}
export function supplierPaymentEnvironment(env:NodeJS.ProcessEnv=process.env){
 return supplierPaymentMode(env)!==null;
}
export type SupplierPaymentRecord={
 id:string;draft_id:string;issuer_id:string;amount_cents:number;paid_on:string;
 reference:string;recorded_by:string;created_at:string;
 reversed_at:string|null;reversed_by:string|null;reversal_reason:string|null;
};
export type CostPaymentOverview={
 draft_id:string;issuer_id:string;invoice_number:string;gross_cents:number;
 recorded_cents:number;remaining_unrecorded_cents:number;
 reversed_cents:number;payment_count:number;reversal_count:number;
 review_status:string;bank_status:'not_reconciled';
};
export function paymentOverview(
 costs:readonly {id:string;legal_entity_id:string;supplier_invoice_number:string;gross_cents:number}[],
 reviews:readonly {draft_id:string;review_status:string}[],
 payments:readonly SupplierPaymentRecord[]
):CostPaymentOverview[]{
 const byId=new Map(costs.map(c=>[c.id,c]));
 if(byId.size!==costs.length)throw Error('Duplicate invoice concepts');
 const history=new Map<string,SupplierPaymentRecord[]>(),seen=new Set<string>();
 for(const p of payments){
  const draft=byId.get(p.draft_id);
  if(!draft||!UUID.test(p.id)||seen.has(p.id)||
   draft.legal_entity_id!==p.issuer_id||
   !Number.isSafeInteger(p.amount_cents)||p.amount_cents<=0||p.amount_cents>100_000_000_000)
   throw Error('Supplier payment source is inconsistent');
  seen.add(p.id);
  history.set(p.draft_id,[...(history.get(p.draft_id)??[]),p]);
 }
 const reviewById=new Map(reviews.map(r=>[r.draft_id,r.review_status]));
 return costs.map(c=>{
  if(!Number.isSafeInteger(c.gross_cents)||c.gross_cents<=0)throw Error('Invalid invoice amount');
  const list=history.get(c.id)||[];
  const recorded=list.filter(p=>!p.reversed_at).reduce((sum,p)=>sum+p.amount_cents,0);
  const reversed=list.filter(p=>!!p.reversed_at).reduce((sum,p)=>sum+p.amount_cents,0);
  if(!Number.isSafeInteger(recorded)||recorded>c.gross_cents||!Number.isSafeInteger(reversed))
   throw Error('Supplier payment registration exceeds invoice');
  return {
   draft_id:c.id,issuer_id:c.legal_entity_id,invoice_number:c.supplier_invoice_number,
   gross_cents:c.gross_cents,recorded_cents:recorded,remaining_unrecorded_cents:c.gross_cents-recorded,
   reversed_cents:reversed,payment_count:list.filter(p=>!p.reversed_at).length,
   reversal_count:list.filter(p=>!!p.reversed_at).length,
   review_status:reviewById.get(c.id)??'pending',bank_status:'not_reconciled' as const
  };
 });
}
/** Fail closed on truncated, cross-entity or unauthorised server RPC results. */
export async function supplierPaymentRows(db:SupabaseClient,costs:readonly {id:string}[]):Promise<SupplierPaymentRecord[]>{
 const events:SupplierPaymentRecord[]=[];
 for(let i=0;i<costs.length;i+=100){
  const ids=costs.slice(i,i+100).map(c=>c.id);
  if(ids.some(id=>!UUID.test(id)))throw Error('Invalid invoice references');
  const {data,error}=await db.rpc('mzs_supplier_payment_source',{p_draft_ids:ids});
  if(error||!data||!Array.isArray(data.rows)||data.count!==data.rows.length)
   throw Error('Supplier payment source unavailable');
  events.push(...data.rows);
 }
 return events;
}
