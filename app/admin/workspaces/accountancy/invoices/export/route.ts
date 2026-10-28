import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffEnvironmentAvailable} from '../../../../../../lib/security/property-staff';
import {archiveFilters,loadArchive,archiveCsv} from '../../../../../../lib/property-operations/invoice-archive';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:Request){
 if(!staffEnvironmentAvailable())return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin();let f;
 try{const q=new URL(request.url).searchParams;const params:Record<string,string|string[]>={};for(const k of q.keys())params[k]=q.getAll(k).length===1?q.get(k)!:q.getAll(k);f=archiveFilters(params);}catch{return new Response("Invalid selection",{status:400,headers});}
 try{const csv=archiveCsv(await loadArchive(db,f,true));if(Buffer.byteLength(csv)>4*1024*1024)return new Response("Selection too large; choose a year or customer",{status:413,headers});return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="MZS-Gripp-'+(f.year??"all-years")+'.csv"'}});}catch{return new Response("A complete export is unavailable. Choose a smaller selection or try again.",{status:503,headers});}
}
