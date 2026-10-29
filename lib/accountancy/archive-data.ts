import type {SupabaseClient} from '@supabase/supabase-js';
import {allRows} from '../property-operations/staff-data';
import {type ArchiveDocument,type Entity,type Filters,type Language,PAGE_SIZE} from './archive';
export async function archiveLanguage(db:SupabaseClient,userId:string):Promise<Language>{
 const {data,error}=await db.from('mzs_admin_language_preferences').select('language').eq('user_id',userId).maybeSingle();
 if(error)throw Error('Archive preferences unavailable');return data?.language==='es'?'es':'en';
}
export async function archiveEntities(db:SupabaseClient){
 return allRows<Entity>((a,b)=>db.from('mzs_lease_issuers').select('id,name,tax_id',{count:'exact'}).order('name').order('id').range(a,b));
}
export async function archiveRows(db:SupabaseClient,f:Filters):Promise<{rows:ArchiveDocument[];count:number}>{
 let q=db.from('mzs_accountancy_documents').select('*',{count:'exact'});
 if(f.entity!=='all')q=q.eq('issuer_id',f.entity);if(f.year!=='all')q=q.eq('fiscal_year',Number(f.year));
 if(f.category!=='all')q=q.eq('category',f.category);if(f.status!=='all')q=q.eq('review_status',f.status);
 if(f.q)q=q.ilike('title','%'+f.q.replace(/[\\%_]/g,'\\$&')+'%');
 const {data,error,count}=await q.order('fiscal_year',{ascending:false}).order('created_at',{ascending:false}).order('id').range((f.page-1)*PAGE_SIZE,f.page*PAGE_SIZE-1);
 if(error?.code==='PGRST103'&&f.page>1){const first=await archiveRows(db,{...f,page:1});return {rows:[] as ArchiveDocument[],count:first.count};}
 if(error||count===null)throw Error('Archive documents unavailable');return {rows:data as ArchiveDocument[],count};
}
