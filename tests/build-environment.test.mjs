import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function check(env){return spawnSync(process.execPath,['scripts/check-build-environment.mjs'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',...env},encoding:'utf8'});}
test('build refuses missing publishable key and crossed environments',()=>{
 for(const env of [
  {VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
  {VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'},
  {VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'}
 ]) assert.notEqual(check(env).status,0);
});
test('build accepts the isolated Preview configuration',()=>{
 assert.equal(check({VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'}).status,0);
});
