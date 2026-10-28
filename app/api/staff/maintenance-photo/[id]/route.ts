import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../../../../lib/security/property-staff';
import {uuid} from '../../../../../lib/property-operations/staff-work';
import {normalizeMaintenancePhoto} from '../../../../../lib/property-operations/maintenance-photo';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"};
 if(!staffEnvironmentAvailable())return new NextResponse(null,{status:404,headers});
 const db=await createClient();const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return new NextResponse(null,{status:401,headers});
 const {id}=await params;if(!uuid.test(id))return new NextResponse(null,{status:404,headers});
 const {data,error}=await db.from('mzs_ops_maintenance_photos').select('storage_path,sha256,byte_size').eq('id',id).maybeSingle();
 if(error||!data)return new NextResponse(null,{status:404,headers});
 const file=await db.storage.from('mzs-ops-ticket-photos').download(data.storage_path);
 if(file.error||!file.data)return new NextResponse(null,{status:404,headers});
 try{
 const bytes=new Uint8Array(await file.data.arrayBuffer());
 if(bytes.length!==data.byte_size||createHash('sha256').update(bytes).digest('hex')!==data.sha256)throw Error('Integrity mismatch');
 const safe=await normalizeMaintenancePhoto(bytes);
 return new NextResponse(new Uint8Array(safe),{headers:{...headers,'Content-Type':'image/jpeg','Content-Disposition':'inline; filename="onderhoudsfoto.jpg"'}});
 }catch{return new NextResponse(null,{status:422,headers});}
}
