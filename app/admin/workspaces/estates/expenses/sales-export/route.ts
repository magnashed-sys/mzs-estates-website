import {NextRequest} from 'next/server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {staffEnvironmentAvailable} from '../../../../../../lib/security/property-staff';
import {buildAccountantZip} from '../../../../../../lib/property-operations/accountant-archive';
import {salesAccountantFiles} from '../../../../../../lib/accountancy/sales-package';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(request:NextRequest){
 if(!staffEnvironmentAvailable())return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin();
 const q=new URL(request.url).searchParams,entity=q.get('entity')??'',rawYear=q.get('year')??'';
 if(!uuid.test(entity)||!/^20\d{2}$/.test(rawYear)||q.getAll('entity').length!==1||q.getAll('year').length!==1)return new Response('Invalid entity or year.',{status:400,headers});
 try{const {data:source,error}=await db.rpc('mzs_ops_accountant_source',{p_entity:entity});if(error||!source)throw Error();
 const zip=buildAccountantZip(salesAccountantFiles(source,entity,Number(rawYear)));if(zip.length>4*1024*1024)throw Error('Export exceeds response limit');
 return new Response(new Uint8Array(zip),{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="MZS-Sales-Receipts-'+rawYear+'-'+entity.slice(0,8)+'.zip"'}});
 }catch{return new Response('Incomplete financial source data: no export was created.',{status:503,headers});}
}
