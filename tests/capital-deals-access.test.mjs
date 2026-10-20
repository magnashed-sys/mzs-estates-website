import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const code=ts.transpileModule(readFileSync(new URL('../lib/security/capital-deals.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function guard(env,profile={role:'admin',is_active:true},user={id:'synthetic'}) {
 let connections=0;const exports={};
 const db={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:profile,error:null})})})})};
 vm.runInNewContext(code,{exports,process:{env},require:(name)=>name==='next/navigation'?{notFound:()=>{throw Error('404');},redirect:()=>{throw Error('login');}}:{createClient:async()=>{connections++;return db;}}});
 return {exports,connections:()=>connections};
}
const safe={VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'};
test('production and wrongly configured previews fail before database access',async()=>{
 for(const env of [{...safe,VERCEL_ENV:'production'},{...safe,NEXT_PUBLIC_SUPABASE_URL:'https://production.invalid'},{}]){
  const g=guard(env);await assert.rejects(g.exports.requireDealsAdmin(),/404/);assert.equal(g.connections(),0);
 }
});
test('client, scoped-role profile and inactive admin do not gain deal access',async()=>{
 for(const p of [{role:'client',is_active:true},{role:'capital_admin',is_active:true},{role:'admin',is_active:false},null]){
  await assert.rejects(guard(safe,p).exports.requireDealsAdmin(),/404/);
 }
});
test('signed-out visitor must log in; full active admin accepted',async()=>{
 await assert.rejects(guard(safe,undefined,null).exports.requireDealsAdmin(),/login/);
 assert.equal((await guard(safe).exports.requireDealsAdmin()).user.id,'synthetic');
});
