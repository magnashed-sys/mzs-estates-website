import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/security/capital-client-environment.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
test('client summaries accept only correct Preview/Staging or Production/Production pair',()=>{
 const staging='https://senonkpxdtlhyhrubicg.supabase.co',production='https://ptrnjzmcehrhbsfxntgw.supabase.co';
 for(const environment of ['preview','production','development',undefined])for(const url of [staging,production,'https://wrong.invalid',undefined]){
  const exports={};vm.runInNewContext(js,{exports,process:{env:{VERCEL_ENV:environment,NEXT_PUBLIC_SUPABASE_URL:url}}});
  assert.equal(exports.capitalClientEnvironmentAllowed(),(environment==='preview'&&url===staging)||(environment==='production'&&url===production));
 }
});
