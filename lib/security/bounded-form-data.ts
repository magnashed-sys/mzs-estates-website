export class RequestBodyTooLarge extends Error {
 constructor(){super('Request body too large');this.name='RequestBodyTooLarge';}
}

/** Bound actual bytes before parsing, even without Content-Length. */
async function boundedBytes(request:Request,maxBytes:number):Promise<Uint8Array>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new Error('Invalid body limit');
 const declared=request.headers.get('content-length');
 if(declared!==null){
  if(!/^\d+$/.test(declared)||!Number.isSafeInteger(Number(declared)))throw new Error('Invalid content length');
  if(Number(declared)>maxBytes){
   await request.body?.cancel().catch(()=>{});
   throw new RequestBodyTooLarge();
  }
 }
 const reader=request.body?.getReader();
 if(!reader)throw new Error('Missing form body');
 const chunks:Uint8Array[]=[];let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>maxBytes){await reader.cancel().catch(()=>{});throw new RequestBodyTooLarge();}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}

export async function boundedFormData(request:Request,maxBytes:number):Promise<FormData>{
 const bytes=await boundedBytes(request,maxBytes);
 return new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();
}

export async function boundedText(request:Request,maxBytes:number):Promise<string>{
 return new TextDecoder().decode(await boundedBytes(request,maxBytes));
}
