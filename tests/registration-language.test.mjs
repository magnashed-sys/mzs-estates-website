import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHmac} from 'node:crypto';
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const route=compile('../app/api/account/register/route.ts');
const routing={};vm.runInNewContext(compile('../i18n/public-routing.ts'),{exports:routing});
function harness({enabled=true,rate=true,duplicate=false,application=true}={}) {
 const signups=[],exports={};
 const admin={rpc:async()=>({data:rate}),from(table){const q={select(){return q},eq(){return q},ilike(){return q},is(){return q},in(){return q},like(){return q},order(){return q},limit:async()=>({data:table==='profiles'&&duplicate?[{id:'existing'}]:[]}),maybeSingle:async()=>({data:application?{id:'request'}:null})};return q;}};
 vm.runInNewContext(route,{exports,console:{error(){}},process:{env:{VERCEL_ENV:'production',MZS_ACCOUNT_REGISTRATION_ENABLED:String(enabled),NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test',SUPABASE_SERVICE_ROLE_KEY:'secret-test'}},require(name){
  if(name==='node:crypto')return {createHmac};
  if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,...options})}};
  if(name.endsWith('/public-routing'))return routing;
  if(name.endsWith('/notifications'))return {deliverOnce:async()=>{throw Error('No mail expected')}};
  if(name==='@supabase/supabase-js')return {createClient:(_url,key)=>key==='secret-test'?admin:{auth:{signUp:async input=>{signups.push(input);return {data:{user:{id:'local-user'},session:null}}}}}};
  throw Error(name);
 }});
 const post=async body=>{const req=new Request('https://www.mzsgroup.com/api/account/register',{method:'POST',body:JSON.stringify(body),headers:{origin:'https://www.mzsgroup.com'}});req.nextUrl=new URL(req.url);return exports.POST(req);};
 return {post,signups};
}
const valid={full_name:'Local Tester',email:'test@example.invalid',password:'local-password',confirm_password:'local-password',interests:['investment']};
test('Registration stores only an allowlisted language alongside the existing signup metadata',async()=>{
 for(const [input,expected] of [['nl','nl'],['ru','ru'],['es','es'],['en','en'],['fr','en'],[undefined,'en'],[{role:'admin'},'en']]) {
  const h=harness();assert.equal((await h.post({...valid,preferred_language:input,role:'admin',is_active:true})).status,201);
  const signup=h.signups[0];assert.equal(signup.options.data.preferred_language,expected);
  assert.equal(signup.options.data.mzs_access_request,'v2');assert.equal(signup.options.data.role,undefined);assert.equal(signup.options.data.is_active,undefined);
  assert.equal(signup.options.emailRedirectTo,'https://www.mzsgroup.com/registration-pending');
 }
});
test('Language cannot bypass registration switch, duplicate or rate checks; partial signup stays an error',async()=>{
 for(const [options,status,count] of [[{enabled:false},503,0],[{rate:false},429,0],[{duplicate:true},409,0],[{application:false},503,1]]) {
  const h=harness(options);const result=await h.post({...valid,preferred_language:'ru'});assert.equal(result.status,status);assert.equal(h.signups.length,count);
  if(count)assert.match(result.body.error,/do not register twice/);
 }
});
