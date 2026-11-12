import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/property-operations/scanner/cloudmersive-advanced.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Buffer,Uint8Array,FormData,Blob,AbortController,setTimeout,clearTimeout,fetch});
const base={environment:'preview',supabaseUrl:'https://senonkpxdtlhyhrubicg.supabase.co',enabled:'true',processorApproved:'true',apiKey:'synthetic-not-real-1234567890',region:'eu-de',apiBaseUrl:'https://synthetic-eu.cloudmersive.com'};
test('scanner requires explicit regional endpoint and refuses global or arbitrary endpoints',()=>{
 assert.equal(exports.scannerIsExplicitlyEnabled(base),true);
 for(const apiBaseUrl of [undefined,'https://api.cloudmersive.com','http://eu.cloudmersive.com','https://cloudmersive.com.evil.test','https://x.cloudmersive.com/path','https://user:pass@x.cloudmersive.com']){
  assert.equal(exports.scannerIsExplicitlyEnabled({...base,apiBaseUrl}),false);
 }
 assert.equal(exports.scannerIsExplicitlyEnabled({...base,region:'us'}),false);
});
test('production scanner requires separate release gate and correct database',()=>{
 const prod={...base,environment:'production',supabaseUrl:'https://ptrnjzmcehrhbsfxntgw.supabase.co'};
 assert.equal(exports.scannerIsExplicitlyEnabled(prod),false);
 assert.equal(exports.scannerIsExplicitlyEnabled({...prod,productionReady:'true'}),true);
 assert.equal(exports.scannerIsExplicitlyEnabled({...base,productionReady:'true',supabaseUrl:prod.supabaseUrl}),false);
});
test('blocked configuration never transfers invoice bytes',async()=>{
 let calls=0;const result=await exports.scanStagingPdfWithCloudmersive(Buffer.from('%PDF-'+'.'.repeat(128)),{...base,apiBaseUrl:undefined},async()=>{calls++;throw Error()});
 assert.equal(result.reason,'disabled');assert.equal(calls,0);
});
