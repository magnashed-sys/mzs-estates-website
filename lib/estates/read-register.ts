import type {SupabaseClient} from '@supabase/supabase-js';
// Never silently turn the API row limit into a financial total.
export async function readRegister(db:SupabaseClient,table:string){
 const rows=[];for(let offset=0;offset<100000;offset+=500){const {data,error}=await db.from(table).select('*').order('id').range(offset,offset+499);if(error)throw new Error('The rental register could not be fully loaded.');rows.push(...data);if(data.length<500)return rows;}throw new Error('The register exceeds the supported report size.');
}
