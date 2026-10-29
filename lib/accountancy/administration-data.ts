import type {SupabaseClient} from '@supabase/supabase-js';
import {validateYearSource,type YearSource} from './administration';
export async function annualSource(db:SupabaseClient,id:string):Promise<YearSource>{
 const {data,error}=await db.rpc('mzs_accountancy_year_source',{p_year:id});
 if(error||!data)throw Error('Annual administration unavailable');return validateYearSource(data,id);
}
