import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

function load(file,stubs={},window) {
 const exports={};
 new Function('exports','require','window',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,name=>stubs[name],window);
 return exports;
}
const routing=load('i18n/public-routing.ts');
const publicRules=load('lib/analytics/public.ts',{'../../i18n/public-routing':routing});
function fixture(pathname='/nl/about',href='https://www.mzsgroup.com/nl/about') {
 const window={location:{href}};
 const sdk=()=>null;
 const component=load('app/components/PublicSpeedInsights.tsx',{'react/jsx-runtime':jsx,'@vercel/speed-insights/next':{SpeedInsights:sdk},'next/navigation':{usePathname:()=>pathname},'../../lib/analytics/public':publicRules},window);
 return {...component,window,sdk};
}
test('public production pages mount the SDK; preview, login and private areas do not',()=>{
 for(const locale of routing.locales)for(const path of routing.publicPaths){const f=fixture(routing.localizedPath(path,locale));assert.equal(f.default({enabled:true}).type,f.sdk);assert.equal(f.default({enabled:false}),null);}
 for(const path of ['/admin/workspaces/group','/staff','/private/projects/secret','/login','/nl/login','/forgot-password','/auth/confirm','/api/invoices',null])assert.equal(fixture(path).default({enabled:true}),null,path);
});
test('vitals remove query, fragment and stale/private route data without mutating source',()=>{
 const f=fixture(),source={type:'vital',url:'https://www.mzsgroup.com/nl/about?email=private@example.com#token',route:'/private/projects/secret'};
 assert.deepEqual(f.onlyPublicVitals(source),{type:'vital',url:'https://www.mzsgroup.com/nl/about',route:'/nl/about'});
 assert.match(source.url,/email=/);assert.match(source.route,/secret/);
 assert.equal(f.default({enabled:true}).props.debug,false);
});
test('send-time guard rejects events after navigation into private or authentication pages',()=>{
 const f=fixture(),callback=f.default({enabled:true}).props.beforeSend,event={type:'vital',url:'https://www.mzsgroup.com/nl/about'};
 for(const path of ['/admin','/private','/staff','/login','/auth/confirm?token=secret']){f.window.location.href='https://www.mzsgroup.com'+path;assert.equal(callback(event),null,path);}
 f.window.location.href='https://www.mzsgroup.com/nl/consultancy';assert.ok(callback(event));
});
test('private event URLs, external origins, previews and malformed URLs are rejected',()=>{
 const f=fixture();for(const url of ['https://www.mzsgroup.com/private','https://www.mzsgroup.com/login','https://example.com/about','https://mzs-group-preview.vercel.app/about','http://www.mzsgroup.com/about','not a URL'])assert.equal(f.onlyPublicVitals({type:'vital',url}),null,url);
 assert.equal(f.onlyPublicVitals({type:'pageview',url:'https://www.mzsgroup.com/about'}),null);
 assert.equal(fixture('/about','https://preview.vercel.app/about').onlyPublicVitals({type:'vital',url:'https://www.mzsgroup.com/about'}),null);
});
