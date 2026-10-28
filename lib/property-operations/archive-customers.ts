import type {SupabaseClient} from '@supabase/supabase-js';
export type ArchiveCustomer={invoice_id:string;relationship_id:string;source_name:string;relationship_name:string;linked_at:string;basis:string};
export async function archiveCustomers(db:SupabaseClient,ids:string[]):Promise<Map<string,ArchiveCustomer>>{
 if(!ids.length)return new Map();
 if(ids.length>100)throw new Error('Customer lookup exceeds page size');
 const {data,error,count}=await db.from('mzs_invoice_archive_customers').select('invoice_id,relationship_id,source_name,relationship_name,linked_at,basis',{count:'exact'}).in('invoice_id',ids);
 if(error||!data||count!==data.length)throw new Error('Customer links could not be completely loaded');
 const rows=data as ArchiveCustomer[],map=new Map(rows.map(r=>[r.invoice_id,r]));
 if(map.size!==rows.length||rows.some(r=>!ids.includes(r.invoice_id)||!r.relationship_id))throw new Error('Invalid customer links');
 return map;
}
export const customerInvoicesHref=(id:string)=>'/admin/relationships/invoices/'+encodeURIComponent(id);
