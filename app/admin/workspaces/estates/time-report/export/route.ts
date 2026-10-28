import {NextRequest} from 'next/server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffEnvironmentAvailable} from '../../../../../../lib/security/property-staff';
import {loadTimeReport,timeFilters,timeReportCsv,type TimeFilters} from '../../../../../../lib/property-operations/time-report';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:NextRequest){
 if(!staffEnvironmentAvailable())return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin();const query=new URL(request.url).searchParams;
 let filters:TimeFilters;try{
  const params:Record<string,string|string[]>={};for(const key of ['from','until','property','profile']){const values=query.getAll(key);if(values.length)params[key]=values.length===1?values[0]:values;}
  filters=timeFilters(params);
 }catch{return new Response("Choose valid filters and a period of up to 366 days.",{status:400,headers});}
 try{
  const report=await loadTimeReport(db,filters),csv=timeReportCsv(report);
  if(Buffer.byteLength(csv,'utf8')>4*1024*1024)return new Response("The export is too large. Narrow the period, property or staff selection.",{status:413,headers});
  return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="MZS-Time-${filters.from}-${filters.until}.csv"`}});
 }catch{return new Response("Time export unavailable. Refresh the report or narrow the selection; no partial export was created.",{status:503,headers});}
}
