import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
function guard({available=true,user={id:'admin-id'},authError=null,profile={role:'admin',is_active:true},profileError=null}={}){
 let profileReads=0,clients=0;const exports={};
 const db={auth:{getUser:async()=>({data:{user},error:authError})},from:()=>{profileReads++;return {select:()=>({eq:()=>({single:async()=>({data:profile,error:profileError})})})}}};
 new Function('exports','require','Response',ts.transpileModule(readFileSync('lib/security/contract-admin-api.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,n=>{
  if(n==='../supabase/server')return {createClient:async()=>{clients++;return db}};
  if(n==='./estate-contracts')return {contractsAvailable:()=>available};throw Error(n);
 },Response);
 return {run:exports.requireContractAdminApi,reads:()=>profileReads,clients:()=>clients,db};
}
test('API guard distinguishes missing identity, insufficient role and verification failure',async()=>{
 for(const [options,status] of [[{user:null},401],[{authError:Error('invalid')},401],[{profile:{role:'client',is_active:true}},403],[{profile:{role:'admin',is_active:false}},403],[{profile:null},403],[{profileError:Error('database')},503]]){
  const g=guard(options),r=await g.run();assert.equal(r.response.status,status);assert.equal(r.response.headers.get('cache-control'),'private, no-store');assert.equal('db' in r,false);if(status===401)assert.equal(g.reads(),0);
 }
 const disabled=guard({available:false});assert.equal((await disabled.run()).response.status,404);assert.equal(disabled.clients(),0);
 const admin=guard();assert.equal((await admin.run()).db,admin.db);assert.equal(admin.reads(),1);
});
