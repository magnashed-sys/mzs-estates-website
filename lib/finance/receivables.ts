import type {SupabaseClient} from '@supabase/supabase-js';
import type {InvoiceRow} from './invoice-register';
import {archiveCustomers} from '../property-operations/archive-customers';
import {allRows} from '../property-operations/staff-data';
import {dateYear} from '../property-operations/sales-reconciliation';
export const ages={current:'Not overdue',days30:'1–30 days',days60:'31–60 days',days90:'61–90 days',older:'Over 90 days',undated:'Due date to verify',unknown:'Payment to verify',credit:'Credit balance',settled:'Settled'} as const;
export type Age=keyof typeof ages;
export type FollowUp={id:string;source:string;invoice_id:string;revision:number;note:string;next_on:string|null;created_at:string;actor_id:string};
export const invoiceKey=(i:Pick<InvoiceRow,'source'|'id'>)=>i.source+':'+i.id;
export function aging(i:InvoiceRow,today:string):Age{
 if(dateYear(today)===null)throw Error('Invalid aging date');
 if(i.balance===null)return 'unknown';if(!Number.isSafeInteger(i.balance))throw Error('Invalid balance');
 if(i.balance<0)return 'credit';if(i.balance===0)return 'settled';
 if(!i.dueOn)return 'undated';if(dateYear(i.dueOn)===null)throw Error('Invalid due date');
 const days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(i.dueOn+'T12:00:00Z'))/86400000);
 return days<=0?'current':days<=30?'days30':days<=60?'days60':days<=90?'days90':'older';
}
export function receivableGroups(rows:InvoiceRow[],today:string){
 const groups=new Map<string,{key:string;customer:string;customerId:string|null;issuer:string;issuerId:string;rows:InvoiceRow[];outstanding:number;unknown:number;credits:number;buckets:Record<Age,number>}>();
 for(const i of rows){const customerId=i.customerId??null,key=i.issuerId+':'+(customerId??invoiceKey(i));let g=groups.get(key);
  if(!g){g={key,customer:i.customer,customerId,issuer:i.issuer,issuerId:i.issuerId,rows:[],outstanding:0,unknown:0,credits:0,buckets:Object.fromEntries(Object.keys(ages).map(k=>[k,0])) as Record<Age,number>};groups.set(key,g);}
  const bucket=aging(i,today);g.rows.push(i);g.outstanding+=Math.max(0,i.balance??0);g.credits+=Math.max(0,-(i.balance??0));g.unknown+=i.balance===null?1:0;if(i.balance!==null)g.buckets[bucket]+=Math.abs(i.balance);
  if(![g.outstanding,g.credits,...Object.values(g.buckets)].every(Number.isSafeInteger))throw Error('Receivables exceed amount limit');
 }
 return [...groups.values()].sort((a,b)=>b.outstanding-a.outstanding||a.customer.localeCompare(b.customer)||a.key.localeCompare(b.key));
}
export async function withCustomerLinks(db:SupabaseClient,rows:InvoiceRow[]){
 const links=new Map<string,string>(),ids=rows.filter(i=>i.source==='archive').map(i=>i.id);
 for(let n=0;n<ids.length;n+=100)for(const [id,r] of await archiveCustomers(db,ids.slice(n,n+100)))links.set(id,r.relationship_id);
 // Older rental/booking snapshots do not contain a verified relationship ID.
 // Keep them separate rather than matching a current contract or a similar name.
 return rows.map(i=>i.source==='archive'?{...i,customerId:links.get(i.id)??null}:i);
}
export async function loadFollowUps(db:SupabaseClient){
 const rows=await allRows<FollowUp>((a,b)=>db.from('mzs_invoice_follow_ups').select('id,source,invoice_id,revision,note,next_on,created_at,actor_id',{count:'exact'}).order('id').range(a,b));
 const latest=new Map<string,FollowUp>();for(const r of rows){const key=r.source+':'+r.invoice_id;if(!latest.has(key)||latest.get(key)!.revision<r.revision)latest.set(key,r);}return {rows,latest};
}
export type Reminder={source:string;invoice_id:string;issuer_id:string;customer_id:string;number:string;customer:string;issuer:string;email:string;iban:string;due_on:string;balance_cents:number};
export function reminderText(r:Reminder){return {subject:`Payment reminder · ${r.number}`,text:`Dear ${r.customer},\n\nOur records show an outstanding balance of EUR ${(r.balance_cents/100).toFixed(2)} for invoice ${r.number}, due on ${r.due_on}.\n\nIf you have already paid, please reply with your payment reference so we can reconcile our records. Otherwise, please arrange payment using the original invoice details and quote ${r.number}.\n\nKind regards,\n${r.issuer}`};}
