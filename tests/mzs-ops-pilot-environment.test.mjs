import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const path="lib/property-operations/pilot-environment.ts";
const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exports={};
vm.runInNewContext(js,{exports});
const {resolvePilotEnvironment}=exports;
const prod={
 VERCEL_ENV:"production",
 NEXT_PUBLIC_SUPABASE_URL:"https://ptrnjzmcehrhbsfxntgw.supabase.co",
 VERCEL_GIT_COMMIT_SHA:"abcde12345abcde12345abcde12345abcde12345",
 MZS_OPS_PRODUCTION_PILOT_ENABLED:"true",
 MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA:"abcde12345abcde12345abcde12345abcde12345"
};
const stage={
 VERCEL_ENV:"preview",
 NEXT_PUBLIC_SUPABASE_URL:"https://senonkpxdtlhyhrubicg.supabase.co",
 MZS_OPS_STAGING_PILOT_ENABLED:"true"
};
test("Pilot disabled by default in Production and Staging",()=>{
 assert.equal(resolvePilotEnvironment({}),null);
 assert.equal(resolvePilotEnvironment({VERCEL_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL}),null);
 assert.equal(resolvePilotEnvironment({VERCEL_ENV:"preview",NEXT_PUBLIC_SUPABASE_URL:stage.NEXT_PUBLIC_SUPABASE_URL}),null);
});
test("Production pilot requires exact trusted project, SHA and explicit server switch",()=>{
 assert.equal(resolvePilotEnvironment(prod),"production");
 for(const [field,value] of [
  ["MZS_OPS_PRODUCTION_PILOT_ENABLED","false"],
  ["MZS_OPS_PRODUCTION_PILOT_ENABLED",undefined],
  ["MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA","abc123"],
  ["MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA","0000000000000000000000000000000000000000"],
  ["NEXT_PUBLIC_SUPABASE_URL",stage.NEXT_PUBLIC_SUPABASE_URL],
  ["VERCEL_ENV","preview"],
  ["VERCEL_GIT_COMMIT_SHA",undefined]
 ]){
  assert.equal(resolvePilotEnvironment({...prod,[field]:value}),null,"incorrectly enabled with "+field);
 }
});
test("Staging pilot cannot be enabled against Production database or deployment",()=>{
 assert.equal(resolvePilotEnvironment(stage),"staging");
 assert.equal(resolvePilotEnvironment({...stage,VERCEL_ENV:"production"}),null);
 assert.equal(resolvePilotEnvironment({...stage,NEXT_PUBLIC_SUPABASE_URL:prod.NEXT_PUBLIC_SUPABASE_URL}),null);
 assert.equal(resolvePilotEnvironment({...stage,MZS_OPS_STAGING_PILOT_ENABLED:"false"}),null);
});
test("Gate is not by itself authentication; data scope must remain database-enforced",()=>{
 assert.match(source,/Caller must still check user/);
 assert.doesNotMatch(source,/service_role|SUPABASE_SECRET|cookie|authorization\s*:/i);
});
