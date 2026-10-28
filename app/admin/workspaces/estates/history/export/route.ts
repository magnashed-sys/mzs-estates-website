import {NextRequest} from 'next/server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffEnvironmentAvailable} from '../../../../../../lib/security/property-staff';
import {historyFilters,historyCsv,loadHistory,type HistoryFilters} from '../../../../../../lib/property-operations/historical-costs';
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:NextRequest){
 if(!staffEnvironmentAvailable())return new Response(null,{status:404,headers});const {db}=await requireEstateAdmin();
 let filters:HistoryFilters;try{const q=new URL(request.url).searchParams,params:Record<string,string|string[]>={};for(const key of ['year','profile']){const v=q.getAll(key);if(v.length)params[key]=v.length===1?v[0]:v;}filters=historyFilters(params);}catch{return new Response("Invalid historical selection.",{status:400,headers});}
 try{const csv=historyCsv(await loadHistory(db,filters));if(Buffer.byteLength(csv,'utf8')>4*1024*1024)return new Response("Export too large. Select one staff member.",{status:413,headers});return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="MZS-Historical-statements-${filters.year}.csv"`}});}catch{return new Response("Historical source incomplete; no partial export was created.",{status:503,headers});}
}
