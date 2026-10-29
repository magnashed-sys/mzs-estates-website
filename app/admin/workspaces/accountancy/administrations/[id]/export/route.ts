import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {annualSource} from '../../../../../../../lib/accountancy/administration-data';
import {uuid} from '../../../../../../../lib/accountancy/administration';
import {yearAccountantFiles} from '../../../../../../../lib/accountancy/year-package';
import {buildAccountantZip} from '../../../../../../../lib/property-operations/accountant-archive';
export const dynamic='force-dynamic';export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin(),{id}=await params;if(!uuid.test(id))return new Response('Invalid administration.',{status:400,headers});
 try{const source=await annualSource(db,id),zip=buildAccountantZip(yearAccountantFiles(source,id));if(zip.length>4*1024*1024)throw Error('Export exceeds response limit');
 return new Response(new Uint8Array(zip),{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="MZS-Administration-'+source.administration.fiscal_year+'-'+source.administration.issuer_id.slice(0,8)+'.zip"'}});
 }catch{return new Response('The complete year package could not be created. No partial download was returned.',{status:503,headers});}
}
