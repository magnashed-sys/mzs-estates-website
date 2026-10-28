/**
 * Disabled-by-default Cloudmersive Advanced Virus Scan adapter.
 *
 * STAGING ONLY. Invoking this transfers the PDF bytes to a third party.
 * NEVER enable before owner approval of provider, region, DPA/privacy terms.
 * Neither this function nor a client-provided scan result is an authority to
 * create a CLEAN database verdict: the caller must verify source SHA itself.
 *
 * API specification: https://api.cloudmersive.com/docs/virus.asp
 */
export type ScannerVerdict="clean"|"malicious"|"unscannable";
export type ScannerResult={
 verdict:ScannerVerdict;
 engine:"Cloudmersive Advanced Virus Scan";
 version:"v1";
 reason:"clean"|"threat"|"invalid_response"|"disabled"|"network_error";
};
export type ScannerOptions={
 environment:string|undefined;
 supabaseUrl:string|undefined;
 enabled:string|undefined;
 processorApproved:string|undefined;
 apiKey:string|undefined;
};
const STAGING_URL="https://senonkpxdtlhyhrubicg.supabase.co";
const API="https://api.cloudmersive.com/virus/scan/file/advanced";
const MAX_BYTES=4_194_304;
const PROHIBITED_FLAGS=[
 "ContainsExecutable","ContainsInvalidFile","ContainsScript",
 "ContainsPasswordProtectedFile","ContainsRestrictedFileFormat",
 "ContainsMacros","ContainsXmlExternalEntities",
 "ContainsInsecureDeserialization","ContainsHtml","ContainsUnsafeArchive",
 "ContainsOleEmbeddedObject","ContainsUnwantedAction"
] as const;
const RESPONSE_LIMIT=65_536;
const item=(verdict:ScannerVerdict,reason:ScannerResult["reason"]):ScannerResult=>({
 verdict,engine:"Cloudmersive Advanced Virus Scan",version:"v1",reason
});
export function scannerIsExplicitlyEnabled(o:ScannerOptions):boolean{
 return o.environment==="preview" && o.supabaseUrl===STAGING_URL &&
 o.enabled==="true" && o.processorApproved==="true" &&
 typeof o.apiKey==="string" && o.apiKey.length>=20 &&
 !/[\r\n]/.test(o.apiKey);
}
export function interpretCloudmersiveResponse(value:unknown):ScannerResult{
 if(!value||typeof value!=="object"||Array.isArray(value))
  return item("unscannable","invalid_response");
 const x=value as Record<string,unknown>;
 if(typeof x.CleanResult!=="boolean"||!Array.isArray(x.FoundViruses))
  return item("unscannable","invalid_response");
 if(x.FoundViruses.length>0)return item("malicious","threat");
 // An unreported protection flag is unknown, NOT false.
 if(PROHIBITED_FLAGS.some(k=>typeof x[k]!=="boolean"))
  return item("unscannable","invalid_response");
 if(PROHIBITED_FLAGS.some(k=>x[k]===true))return item("malicious","threat");
 if(typeof x.VerifiedFileFormat!=="string" ||
    !["PDF",".PDF","APPLICATION/PDF"].includes(x.VerifiedFileFormat.trim().toUpperCase()))
  return item("unscannable","invalid_response");
 if(x.CleanResult!==true)return item("malicious","threat");
 return item("clean","clean");
}
export async function scanStagingPdfWithCloudmersive(
 bytes:Uint8Array,o:ScannerOptions,send:typeof fetch=fetch
):Promise<ScannerResult>{
 // Check *all* preconditions before calling fetch or creating request body.
 if(!scannerIsExplicitlyEnabled(o))return item("unscannable","disabled");
 if(!bytes||!ArrayBuffer.isView(bytes)||bytes.BYTES_PER_ELEMENT!==1||
    bytes.length<128||bytes.length>MAX_BYTES)
  return item("unscannable","invalid_response");
 if(!Buffer.from(bytes.subarray(0,5)).equals(Buffer.from("%PDF-")))
  return item("unscannable","invalid_response");
 const data=new FormData();
 // Opaque generic filename: no customer, supplier or property names.
 data.set("inputFile",new Blob([Uint8Array.from(bytes)],{type:"application/pdf"}),"test-evidence.pdf");
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),20_000);
 try{
  const response=await send(API,{
   method:"POST",redirect:"error",cache:"no-store",signal:controller.signal,
   headers:{
    Apikey:o.apiKey!,
    allowExecutables:"false",allowInvalidFiles:"false",allowScripts:"false",
    allowPasswordProtectedFiles:"false",allowMacros:"false",
    allowXmlExternalEntities:"false",allowInsecureDeserialization:"false",
    allowHtml:"false",allowUnsafeArchives:"false",
    allowOleEmbeddedObject:"false",allowUnwantedAction:"false",
    restrictFileTypes:".pdf"
   },body:data
  });
  if(!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json"))
   return item("unscannable","invalid_response");
  const contentLength=Number(response.headers.get("content-length")||0);
  if(!Number.isFinite(contentLength)||contentLength>RESPONSE_LIMIT)
   return item("unscannable","invalid_response");
  const body=await response.text();
  if(body.length>RESPONSE_LIMIT)return item("unscannable","invalid_response");
  return interpretCloudmersiveResponse(JSON.parse(body) as unknown);
 }catch{
  return item("unscannable","network_error");
 }finally{
  clearTimeout(timeout);
 }
}
