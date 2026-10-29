import {NextResponse} from 'next/server';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {ARCHIVE_BUCKET,uuid} from '../../../../../../../lib/accountancy/archive';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin(),{id}=await params;
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(!uuid.test(id))return new Response('Not found',{status:404,headers});
 const {data:doc,error}=await db.from('mzs_accountancy_documents').select('file_path,original_name').eq('id',id).maybeSingle();
 if(error)return new Response('Document unavailable',{status:503,headers});if(!doc)return new Response('Not found',{status:404,headers});
 const options=new URL(request.url).searchParams.get('download')==='1'?{download:doc.original_name}:undefined;
 const {data,error:signError}=await db.storage.from(ARCHIVE_BUCKET).createSignedUrl(doc.file_path,60,options);
 if(signError||!data?.signedUrl)return new Response('Document unavailable',{status:503,headers});
 const response=NextResponse.redirect(data.signedUrl,302);for(const [key,value] of Object.entries(headers))response.headers.set(key,value);return response;
}
