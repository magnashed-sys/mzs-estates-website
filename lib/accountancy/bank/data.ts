import type {SupabaseClient} from '@supabase/supabase-js';
import type {BankSnapshot} from './model';
export async function bankSource(db:SupabaseClient,year:string,originals=false):Promise<BankSnapshot>{
 const {data,error}=await db.rpc('mzs_bank_source',{p_year:year,p_originals:originals});
 if(error||!data||!['accounts','batches','transactions','allocations','people','targets'].every(k=>Array.isArray(data[k])))throw Error('Bank register unavailable');
 return data;
}
