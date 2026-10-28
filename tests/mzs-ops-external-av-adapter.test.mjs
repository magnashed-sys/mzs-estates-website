import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {buildMzsSyntheticExpensePdf} from "../scripts/generate-mzs-synthetic-expense-pdf.mjs";

const src=readFileSync(new URL("../lib/property-operations/scanner/cloudmersive-advanced.ts",import.meta.url),"utf8");
const code=ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const subject={};
vm.runInNewContext(code,{
 exports:subject,Buffer,Uint8Array,ArrayBuffer,FormData,Blob,AbortController,
 setTimeout,clearTimeout,fetch:async()=>{throw Error("No real network allowed in tests")}
});
const {scanStagingPdfWithCloudmersive,interpretCloudmersiveResponse,scannerIsExplicitlyEnabled}=subject;
const sample=buildMzsSyntheticExpensePdf();
const approved={
 environment:"preview",supabaseUrl:"https://senonkpxdtlhyhrubicg.supabase.co",
 enabled:"true",processorApproved:"true",apiKey:"SYNTHETIC-KEY-NEVER-USED-00000000"
};
const fields=[
 "ContainsExecutable","ContainsInvalidFile","ContainsScript",
 "ContainsPasswordProtectedFile","ContainsRestrictedFileFormat",
 "ContainsMacros","ContainsXmlExternalEntities","ContainsInsecureDeserialization",
 "ContainsHtml","ContainsUnsafeArchive","ContainsOleEmbeddedObject","ContainsUnwantedAction"
];
const clean=()=>Object.fromEntries([
 ["CleanResult",true],["FoundViruses",[]],["VerifiedFileFormat","PDF"],
 ...fields.map(x=>[x,false])
]);
const http=(data,status=200,type="application/json")=>new Response(JSON.stringify(data),{
 status,headers:{"content-type":type}
});

test("External processing stays strictly disabled without explicit staged provider and privacy approval",async()=>{
 for(const opts of [
  {...approved,enabled:"false"},
  {...approved,processorApproved:"false"},
  {...approved,environment:"production"},
  {...approved,supabaseUrl:"https://ptrnjzmcehrhbsfxntgw.supabase.co"},
  {...approved,apiKey:undefined}
 ]){
  let calls=0;
  const response=await scanStagingPdfWithCloudmersive(sample,opts,async()=>{calls++;return http(clean())});
  assert.equal(response.verdict,"unscannable");
  assert.equal(calls,0,"Disabled scanner may not send documents to a third party");
  assert.equal(scannerIsExplicitlyEnabled(opts),false);
 }
});
test("Explicit opt-in sends only PDF bytes to the fixed HTTPS advanced endpoint with all dangerous features blocked",async()=>{
 let observed;
 const result=await scanStagingPdfWithCloudmersive(sample,approved,async(url,opts)=>{
  observed={url,opts};
  return http(clean());
 });
 assert.equal(result.verdict,"clean");
 assert.equal(observed.url,"https://api.cloudmersive.com/virus/scan/file/advanced");
 assert.equal(observed.opts.method,"POST");
 assert.equal(observed.opts.redirect,"error");
 assert.equal(observed.opts.cache,"no-store");
 assert.equal(observed.opts.headers.Apikey,approved.apiKey);
 assert.equal(observed.opts.headers.restrictFileTypes,".pdf");
 for(const [name,val] of Object.entries(observed.opts.headers)){
  if(name.startsWith("allow"))assert.equal(val,"false");
 }
 const attachment=observed.opts.body.get("inputFile");
 assert.equal(attachment.type,"application/pdf");
 assert.equal(attachment.size,sample.length);
 assert.equal(Buffer.compare(Buffer.from(await attachment.arrayBuffer()),sample),0);
 assert.equal(result.reason,"clean");
});
test("Unknown, malformed and suspicious scanner output always remains quarantined",()=>{
 assert.equal(interpretCloudmersiveResponse(null).verdict,"unscannable");
 assert.equal(interpretCloudmersiveResponse({CleanResult:true}).verdict,"unscannable");
 for(const flag of fields){
  const unsafe=clean();unsafe[flag]=true;
  assert.equal(interpretCloudmersiveResponse(unsafe).verdict,"malicious",flag);
  const missing=clean();delete missing[flag];
  assert.equal(interpretCloudmersiveResponse(missing).verdict,"unscannable",flag);
 }
 const infected=clean();infected.FoundViruses=[{VirusName:"TEST-DETECTION"}];
 assert.equal(interpretCloudmersiveResponse(infected).verdict,"malicious");
 const failed=clean();failed.CleanResult=false;
 assert.equal(interpretCloudmersiveResponse(failed).verdict,"malicious");
 const noFormat=clean();noFormat.VerifiedFileFormat="";
 assert.equal(interpretCloudmersiveResponse(noFormat).verdict,"unscannable");
});
test("Timeout, 429, non-JSON responses, malformed JSON and bad input cannot return clean",async()=>{
 for(const response of [http(clean(),429),http(clean(),200,"text/plain"),
 new Response("{not valid",{headers:{"content-type":"application/json"}})]){
  const result=await scanStagingPdfWithCloudmersive(sample,approved,async()=>response);
  assert.equal(result.verdict,"unscannable");
 }
 assert.equal((await scanStagingPdfWithCloudmersive(sample,approved,async()=>{throw Error("timeout") })).verdict,"unscannable");
 assert.equal((await scanStagingPdfWithCloudmersive(Buffer.from("not pdf"),approved,async()=>{throw Error("must not send") })).verdict,"unscannable");
});
