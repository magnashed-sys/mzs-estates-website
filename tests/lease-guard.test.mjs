import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const source=ts.transpileModule(readFileSync('lib/security/estate-contracts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function setup(env){const exports={};let guarded=0;vm.runInNewContext(source,{exports,process:{env},require:name=>name==='next/navigation'?{notFound:()=>{throw Error('404')}}:{requireEstateAdmin:async()=>{guarded++;return 'admin-checked'}}});return {exports,guarded:()=>guarded};}
test('lease module rejects local and crossed environment/database pairs',async()=>{for(const env of [{VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'},{VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'},{}]){const s=setup(env);await assert.rejects(s.exports.requireContractAdmin(),/404/);assert.equal(s.guarded(),0);}});
test('isolated lease Preview still requires existing active Group administrator guard',async()=>{const s=setup({VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'});assert.equal(await s.exports.requireContractAdmin(),'admin-checked');assert.equal(s.guarded(),1);});

test('Production lease module still requires active full administrator guard',async()=>{const s=setup({VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'});assert.equal(await s.exports.requireContractAdmin(),'admin-checked');assert.equal(s.guarded(),1);});
