import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const routes=[
 'app/api/admin/rental-summary/route.ts',
 'app/api/admin/staff-week/export/route.ts',
 'app/api/admin/zorgbalans/invoices/[id]/pdf/route.ts',
 'app/admin/group/estates/contracts/invoices/[id]/pdf/route.ts',
];
function compile(path,require){
 const exports={};
 new Function('exports','require','Response','URL',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require,Response,URL);
 return exports;
}
for(const path of routes)test(path+' rejects unauthorized requests before reading business data',async()=>{
 for(const [user,profile,profileError,available,status] of [
  [null,null,null,true,401],
  [{id:'fixture'},{role:'client',is_active:true},null,true,403],
  [{id:'fixture'},{role:'partner',is_active:true},null,true,403],
  [{id:'fixture'},{role:'admin',is_active:false},null,true,403],
  [{id:'fixture'},null,null,true,403],
  [{id:'fixture'},null,{message:'private database detail'},true,503],
  [{id:'fixture'},{role:'admin',is_active:true},null,false,404],
 ]){
  let businessReads=0;
  const db={auth:{getUser:async()=>({data:{user},error:null})},from(table){
   if(table!=='profiles'){businessReads++;throw Error('Business data accessed');}
   return {select:()=>({eq:()=>({single:async()=>({data:profile,error:profileError})})})};
  }};
  const guard=compile('lib/security/contract-admin-api.ts',name=>{
   if(name==='../supabase/server')return {createClient:async()=>db};
   if(name==='./estate-contracts')return {contractsAvailable:()=>available};
   throw Error(name);
  });
  const handler=compile(path,name=>{
   if(name.endsWith('/contract-admin-api'))return guard;
   if(name.endsWith('/property-staff'))return {staffEnvironmentAvailable:()=>available};
   // These dependencies must not be called before access is established.
   return new Proxy({}, {get(){return ()=>{businessReads++;throw Error('Protected dependency called');};}});
  });
  const result=await handler.GET(new Request('https://example.invalid/?profile=fixture'),{params:Promise.resolve({id:'00000000-0000-4000-8000-000000000001'})});
  assert.equal(result.status,status);
  assert.equal(result.headers.get('cache-control'),'private, no-store');
  assert.equal(result.headers.get('location'),null);
  assert.equal(businessReads,0);
  assert.doesNotMatch(await result.text(),/private database detail/);
 }
});
