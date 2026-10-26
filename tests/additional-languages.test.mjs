import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@formatjs/icu-messageformat-parser';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const locales=['de','it','fr','pt-BR','ar','tr','lt','pl','zh-CN','sv','ro','nb'];
const en=JSON.parse(read('messages/en.json'));
const routing={};vm.runInNewContext(ts.transpileModule(read('i18n/public-routing.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:routing});
function args(nodes,out=new Set()) {for(const n of nodes){if([1,2,3,4,5,6].includes(n.type))out.add(n.value);if(n.options)for(const o of Object.values(n.options))args(o.value,out);if(n.children)args(n.children,out);}return [...out].sort();}
for(const locale of locales){
 const messages=JSON.parse(read(`messages/${locale}.json`));
 test(`${locale}: all 1132 messages preserve source structure and ICU arguments`,()=>{
  let count=0;
  function check(a,b,path=''){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a)){
   if(typeof a[k]==='object')check(a[k],b[k],path+k+'.');else{count++;assert.equal(typeof b[k],'string');assert.ok(b[k].trim());assert.deepEqual(args(parse(a[k])),args(parse(b[k])),path+k);}
  }}check(en,messages);assert.equal(count,1132);
 });
 test(`${locale}: public routes roundtrip while private/API/token routes stay unprefixed`,()=>{
  assert.equal(routing.memberLocale(locale),locale);
  for(const path of routing.localizedPaths){const r=routing.publicRoute(routing.localizedPath(path,locale));assert.equal(r.locale,locale);assert.equal(r.path,path);}
  for(const path of ['/admin','/private','/private/profile','/private/capital','/api/account/register','/auth/confirm',...routing.accountPaths]){assert.equal(routing.publicRoute('/'+locale+path),null);assert.equal(routing.localizedPath(path,locale),path);}
  assert.equal(routing.languageAlternates('/real-estate')[locale],`/${locale}/real-estate`);
 });
 test(`${locale}: plural messages render zero, one, two, few, many and fractional quantities`,()=>{
  const errors=[];const t=createTranslator({locale,messages,namespace:'ProjectUI',onError:e=>errors.push(e)});
  for(const count of [0,1,2,3,5,11,21,100,1.5])for(const key of ['minimumStay','nightlyCalculation','estimatedMinimum','rooms','guestLimit','viewAll','photoCount']){
   const s=t(key,{count,bedrooms:count,bathrooms:count,price:'€400'});assert.ok(s.length>0);assert.doesNotMatch(s,/\{(?:count|bedrooms|bathrooms)/);
  }assert.deepEqual(errors,[]);
 });
}
test('Arabic direction is presentation-only and Brazilian Portuguese stays distinct',()=>{
 assert.equal(routing.localeDirection('ar'),'rtl');
 for(const locale of ['en','nl','es','ru','de','it','fr','pt-BR','tr','lt','pl','zh-CN','sv','ro','nb'])assert.equal(routing.localeDirection(locale),'ltr');
 for(const unsupported of ['pt','pt-PT','ar/admin','__proto__',null,{role:'admin'}]){assert.equal(routing.isLocale(unsupported),false);assert.equal(routing.memberLocale(unsupported),'en');}
 assert.match(read('app/layout.tsx'),/dir=\{localeDirection\(locale\)\}/);
 assert.match(read('app/rtl.css'),/input\[type="email"\].*direction:ltr/);
});
