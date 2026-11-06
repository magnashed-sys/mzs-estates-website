import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
test('signout rejects foreign and missing origins before touching sessions',async()=>{
 let calls=0;const exports={};
 new Function('exports','require',ts.transpileModule(readFileSync('app/auth/signout/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,n=>{
  if(n==='next/server')return {NextResponse:{json:(body,init)=>Response.json(body,init),redirect:()=>({cookies:{set(){}},headers:new Headers()})}};
  if(n==='@supabase/ssr')return {createServerClient:()=>{calls++;return {auth:{signOut:async()=>({error:null})}}}};
  throw Error(n);
 });
 for(const origin of [null,'https://foreign.invalid']){const headers=new Headers();if(origin)headers.set('origin',origin);const r=await exports.POST({headers,nextUrl:new URL('https://mzs.example/auth/signout')});assert.equal(r.status,403);assert.equal(calls,0);}
 const r=await exports.POST({headers:new Headers({origin:'https://mzs.example'}),nextUrl:new URL('https://mzs.example/auth/signout'),url:'https://mzs.example/auth/signout'});
 assert.equal(calls,1);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
