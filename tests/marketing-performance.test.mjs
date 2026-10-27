import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(file,modules={}){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const exports={};new Function('require','exports',code)(n=>modules[n],exports);return exports;}
const routing=load('i18n/public-routing.ts');
async function run(path,cookies=[],method='GET'){
 let calls=0,forwarded;
 const response=()=>({headers:new Headers(),cookies:{set(){}}});
 const next={next({request}){forwarded=request.headers;return response()},redirect:()=>response()};
 const mod=load('middleware.ts',{'next/server':{NextResponse:next},'./i18n/public-routing':routing,'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>{calls++;return {data:{user:null}}}}})}});
 const url=new URL('https://example.test'+path);url.clone=()=>new URL(url);
 await mod.middleware({method,headers:new Headers({'x-mzs-locale':'forged'}),nextUrl:url,cookies:{get:n=>cookies.find(c=>c.name===n),getAll:()=>cookies,set(){}}});
 return {calls,forwarded};
}
test('only anonymous marketing GET/HEAD requests skip auth refresh, in every locale',async()=>{
 for(const locale of routing.locales)for(const path of routing.publicPaths){const result=await run(routing.localizedPath(path,locale));assert.equal(result.calls,0);assert.equal(result.forwarded.get('x-mzs-locale'),locale);}
 assert.equal((await run('/nl/about',[],'HEAD')).calls,0);
});
test('auth cookies, account/private/API routes and POST preserve session checks',async()=>{
 for(const name of ['sb-project-auth-token','sb-project-auth-token.0','sb-project-auth-token.1'])assert.equal((await run('/nl/about',[{name,value:'token'}])).calls,1);
 for(const path of ['/login','/nl/login','/private','/admin','/api/intro-calls','/request-access','/nl/about/extra'])assert.equal((await run(path)).calls,1);
 assert.equal((await run('/nl/about',[],'POST')).calls,1);
});
test('image cache rules are limited to public marketing assets',()=>{
 const config=readFileSync(new URL('../next.config.mjs',import.meta.url),'utf8');
 assert.ok(config.includes('public, max-age=3600, must-revalidate'));
 const assetList=config.match(/\.\.\.\[(.*?)\]\.map\(source/s)?.[1];assert.ok(assetList);
 const paths=[...assetList.matchAll(/'([^']+)'/g)].map(m=>m[1]);assert.equal(paths.length,7);
 for(const path of paths)assert.match(path,/^\/images\/[a-z0-9/.-]+\.(webp|jpg|svg)$/);
});
