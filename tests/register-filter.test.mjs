import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/admin/use-register-filter.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function browser(href){
 const calls=[];
 const win={location:{href},history:{replaceState(data,title,path){calls.push(path);win.location.href=new URL(path,win.location.href).href;}}};
 const exports={};
 new Function('require','exports','window',code)(()=>({useSearchParams:()=>new URL(win.location.href).searchParams}),exports,win);
 return {filter:exports.useRegisterFilter,win,calls};
}
test('restores search and supported filters on reload or return',()=>{
 const b=browser('https://example.org/admin/relationships?q=Jansen&kind=company');
 assert.equal(b.filter('q')[0],'Jansen');assert.equal(b.filter('kind','all',['all','company'])[0],'company');
 b.filter('q')[1]('A & B');assert.equal(b.filter('q')[0],'A & B');
 assert.equal(b.filter('kind')[0],'company');assert.equal(b.calls.length,1);
});
test('defaults active contracts and rejects unsupported status',()=>{
 const b=browser('https://example.org/admin/group/estates/contracts?status=unknown');
 assert.equal(b.filter('status','active',['active','all'])[0],'active');
 b.filter('status','active',['active','all'])[1]('bad');
 assert.equal(new URL(b.win.location.href).searchParams.has('status'),false);
});
test('batched resets preserve view, profile, unrelated filters and fragment',()=>{
 const b=browser('https://example.org/admin/group/estates/contracts?view=billing&profile=123&q=test&entity=456&paymentStatus=paid#results');
 const [,q]=b.filter('q');const [,entity]=b.filter('entity');q('');entity('');
 const url=new URL(b.win.location.href);
 assert.equal(url.searchParams.get('view'),'billing');assert.equal(url.searchParams.get('profile'),'123');
 assert.equal(url.searchParams.get('paymentStatus'),'paid');assert.equal(url.searchParams.has('q'),false);
 assert.equal(url.searchParams.has('entity'),false);assert.equal(url.hash,'#results');
});
