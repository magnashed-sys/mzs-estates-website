import type {SupabaseClient} from '@supabase/supabase-js';
import {allRows} from '../property-operations/staff-data';
import type {DocumentLink,LinkKind} from './document-links';
export async function documentLinks(db:SupabaseClient,kind:LinkKind,ids:string[]):Promise<DocumentLink[]>{
 const column=kind==='cost'?'draft_id':'property_id',rows:DocumentLink[]=[];
 for(let i=0;i<ids.length;i+=100){
  const batch=await allRows<any>((a,b)=>db.from('mzs_accountancy_document_links').select('*,document:mzs_accountancy_documents(*)',{count:'exact'}).in(column,ids.slice(i,i+100)).order('created_at',{ascending:false}).order('id').range(a,b));
  for(const r of batch){const document=Array.isArray(r.document)?r.document[0]:r.document;if(!document)throw Error('Linked document unavailable');rows.push({...r,document});}
 }
 return rows;
}
