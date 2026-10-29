/**
 * Server-to-server PDF evidence transfer contract, not a ChatGPT file-link fetcher.
 * No secret, bearer credential, or raw PDF is ever written to repository files.
 */
export const ASSISTANT_MAX_PDF_BYTES=4*1024*1024;
const STAGING='https://senonkpxdtlhyhrubicg.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
export type BridgeHeaders={draftId:string;filename:string;sha256:string;token:string};
export function isAssistantBridgeStaging(env:NodeJS.ProcessEnv=process.env):boolean {
 return env.VERCEL_ENV==='preview'&&
  env.NEXT_PUBLIC_SUPABASE_URL===STAGING&&
  env.MZS_ASSISTANT_PDF_BRIDGE_ENABLED==='true';
}
export function bridgeHeaders(headers:Headers):BridgeHeaders{
 const auth=headers.get('authorization')??'';
 // A publishable/secret Supabase API key is NOT a user JWT.
 const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(auth);
 if(!match||match[1].length<80||match[1].length>8192)throw Error('unauthenticated');
 const draftId=headers.get('x-mzs-cost-draft-id')??'';
 const sha256=headers.get('x-mzs-file-sha256')??'';
 if(!UUID.test(draftId)||!SHA.test(sha256))throw Error('invalid_headers');
 let filename='';
 try{filename=decodeURIComponent(headers.get('x-mzs-file-name')??'');}catch{throw Error('invalid_headers');}
 if(filename.length<5||filename.length>160||!filename.toLowerCase().endsWith('.pdf')||
  /[\x00-\x1f\x7f\/\\]/.test(filename))throw Error('invalid_headers');
 return {draftId,filename,sha256,token:match[1]};
}
export async function boundedPdf(request:Request):Promise<Uint8Array>{
 if(!/^application\/pdf(?:\s*;\s*[^;]+)?$/i.test(request.headers.get('content-type')??''))
  throw Error('pdf_required');
 if(request.headers.get('content-encoding'))throw Error('pdf_required');
 const rawLength=request.headers.get('content-length');
 if(rawLength!==null){
  if(!/^\d{1,9}$/.test(rawLength))throw Error('pdf_required');
  if(Number(rawLength)>ASSISTANT_MAX_PDF_BYTES)throw Error('too_large');
 }
 const reader=request.body?.getReader();
 if(!reader)throw Error('pdf_required');
 const parts:Uint8Array[]=[];let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.length;
   if(total>ASSISTANT_MAX_PDF_BYTES){
    await reader.cancel();
    throw Error('too_large');
   }
   parts.push(value);
  }
 }catch(e){if(e instanceof Error&&e.message==='too_large')throw e;throw Error('interrupted');}
 if(total<128)throw Error('invalid_pdf');
 const bytes=new Uint8Array(total);let offset=0;
 for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('invalid_pdf');
 return bytes;
}
