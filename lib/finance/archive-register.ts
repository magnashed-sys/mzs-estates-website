import type {SupabaseClient} from '@supabase/supabase-js';
import type {HistoricalInvoice} from './financial-report';

/** Immutable archive; exact counts prevent a truncated page from becoming a total. */
export async function readFinancialArchive(db:SupabaseClient,year:number):Promise<HistoricalInvoice[]>{
 if(year!==2026)return [];
 const rows:HistoricalInvoice[]=[];
 let expected:number|undefined;
 for(let offset=0;offset<100000;offset+=500){
  const {data,error,count}=await db.from('mzs_invoice_archive')
   .select('id,issuer_id,number,issued_on,net_cents,gross_cents,source_paid_cents,source_open_cents',{count:'exact'})
   .gte('issued_on',year+'-01-01').lt('issued_on',(year+1)+'-01-01')
   .order('id').range(offset,offset+499);
  if(error||!data||count===null||!Number.isSafeInteger(count)||count<0)throw new Error('Incomplete historical invoice register');
  if(expected!==undefined&&count!==expected)throw new Error('Historical invoice register changed during read');
  expected=count;rows.push(...data as HistoricalInvoice[]);
  if(data.length<500){
   if(rows.length!==expected)throw new Error('Incomplete historical invoice register');
   return rows;
  }
 }
 throw new Error('Historical invoice register exceeds reporting limit');
}
