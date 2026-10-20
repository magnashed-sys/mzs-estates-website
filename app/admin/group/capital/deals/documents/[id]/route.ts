import {NextResponse} from 'next/server';
import {requireDealsAdmin} from '../../../../../../../lib/security/capital-deals';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {db}=await requireDealsAdmin();const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return new NextResponse('Not found',{status:404});
 const {data:doc,error}=await db.from('mzs_capital_documents').select('file_path').eq('id',id).single();
 if(error||!doc)return new NextResponse('Not found',{status:404});
 const {data,error:signedError}=await db.storage.from('mzs-private-capital-documents').createSignedUrl(doc.file_path,60);
 if(signedError||!data?.signedUrl)return new NextResponse('Document unavailable',{status:503});
 const response=NextResponse.redirect(data.signedUrl,302);response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
