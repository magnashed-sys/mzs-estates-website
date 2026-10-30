import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import * as phone from 'libphonenumber-js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(path,deps={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{assert.ok(Object.hasOwn(deps,n),n);return deps[n];}});
 return exports;
}
const routing=load('i18n/public-routing.ts');
const codes=['da','uk','fi','cs','hu','bg','sk','el'];
const order=['en','nl','de','fr','es','it','da','nb','sv','fi','cs','sk','pl','hu','lt','uk','ro','bg','el','ru','tr','zh-CN','ar','pt-BR'];
const expectedNames=['English','Nederlands','Deutsch','Français','Español','Italiano','Dansk','Norsk bokmål','Svenska','Suomi','Čeština','Slovenčina','Polski','Magyar','Lietuvių','Українська','Română','Български','Ελληνικά','Русский','Türkçe','简体中文','العربية','Português (Brasil)'];
const mail=load('lib/mzs/localized-account-mail.ts');
const contacts=load('lib/contact-inputs.ts',{'libphonenumber-js':phone,'./european-country-names.json':{default:JSON.parse(read('lib/european-country-names.json'))}});
const visits=load('lib/mzs/visitor-report.ts');
const rental=JSON.parse(read('lib/mzs/rental-mail-copy.json'));
const analytics=load('lib/analytics/copy.ts').analyticsCopy;
const compact=load('lib/analytics/compact-copy.ts').analyticsCompactCopy;
const work=load('app/about/work-copy.ts');
const extra=load('app/private/projects/[slug]/nuciaExtraCopy.ts');
const neighbourhood=load('app/private/projects/[slug]/nuciaNeighbourhoodCopy.ts').nuciaNeighbourhoodCopy;
const plan=load('app/private/projects/[slug]/sitePlanCopy.ts').sitePlanCopy;
const video=load('app/private/projects/[slug]/nuciaVideoNotes.ts').nuciaVideoNotes;

test('All public, inline and account flag menus render the requested twenty-four-language order',()=>{
 assert.deepEqual(Array.from(routing.locales),order);
 for(const locale of ['en',...codes,'ar'])for(const account of [false,true])for(const inline of [false,true]){
  const messages=JSON.parse(read(`messages/${locale}.json`));
  const Switcher=load('app/components/LanguageSwitcher.tsx',{
   react:React,'react/jsx-runtime':jsx,'next-intl':{useLocale:()=>locale,useTranslations:ns=>createTranslator({locale,messages,namespace:ns})},
   'next/navigation':{usePathname:()=>account?'/private/profile':routing.localizedPath('/about',locale)},
   '../../i18n/public-routing':routing,'../../lib/supabase/client':{createClient:()=>{throw Error('render must not mutate auth')}},
   '../../i18n/client-preference':{},'./PublicHeader.module.css':{default:{}}
  }).default;
  const html=renderToStaticMarkup(React.createElement(Switcher,{account,inline}));
  assert.deepEqual([...html.matchAll(/hrefLang="([^"]+)"/gi)].map(m=>m[1]),order);
  assert.deepEqual([...html.matchAll(/<a[^>]+aria-label="([^"]+)"/g)].map(m=>m[1]),expectedNames);
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  if(account)assert.equal((html.match(/href="\/private\/profile"/g)||[]).length,24);
 }
});
for(const code of codes){
 test(`${code}: account mail keeps private links and escapes untrusted names`,()=>{
  assert.ok(mail.isLocalizedAccountLocale(code));
  for(const[event_type,path]of [['account_activated',`/${code}/login`],['new_project_access','/private'],['capital_access_granted','/private/capital']]){
   const m=mail.localizedAccountMail({event_type,payload:{projects:['<script>evil</script>'],project:'<script>evil</script>',amount:987654321,borrower:'PRIVATE-BORROWER'}},'<img onerror=x>',code,'https://example.invalid');
   assert.ok(m.html.includes(`href="https://example.invalid${path}"`));
   assert.ok(m.html.includes(`lang="${code}" dir="ltr"`));assert.doesNotMatch(m.html,/<script>|<img|987654321|PRIVATE-BORROWER/);
  }
 });
 test(`${code}: ancillary copy and locale-native countries are present`,()=>{
  assert.equal(analytics[code].length,6);assert.equal(compact[code].length,4);
  assert.ok(analytics[code][5].includes('180'));assert.ok(analytics[code][5].includes('info@mzsgroup.eu'));
  assert.deepEqual(Object.keys(work.getWorkCopy(code)),Object.keys(work.getWorkCopy('en')));
  assert.notEqual(work.getWorkCopy(code).careerTitle,work.getWorkCopy('en').careerTitle);
  assert.equal(Object.keys(extra.nuciaExtraCopy(code)).length,8);
  assert.equal(neighbourhood[code].length,8);assert.equal(plan[code].length,7);assert.ok(video[code].includes('2025'));
  for(const region of ['NL','DK','UA','FI','CZ','HU','BG','SK','GR'])assert.equal(contacts.countryCode(contacts.countryName(region,code)),region);
  for(const section of ['title','intro','status','labels'])assert.deepEqual(Object.keys(rental[code][section]).sort(),Object.keys(rental.lt[section]).sort());
  assert.notEqual(rental[code].intro.requested,rental[code].intro.confirmed);
  assert.notEqual(rental[code].status.cancelled,rental[code].status.confirmed);
  assert.equal(visits.visitorPath(`/${code}/real-estate`),'/real-estate');
  assert.equal(visits.visitorPath(`/${code}/auth/confirm?token_hash=secret`),null);
 });
 test(`${code}: saved preference, cookie preference and public header resolve full catalogs`,async()=>{
  for(const saved of [code,'invalid',null]){
   const config=load('i18n/request.ts',{
    'next/headers':{headers:async()=>new Map([['x-mzs-client-overview','true']]),cookies:async()=>({get:()=>({value:code})})},
    'next-intl/server':{getRequestConfig:fn=>fn},
    '../lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{user_metadata:{preferred_language:saved}}}})}})},
    './public-routing':routing,'../lib/admin/language':{getAdminLanguage:async()=>{throw Error('not admin')}},
    [`../messages/${code}.json`]:{default:JSON.parse(read(`messages/${code}.json`))}
   }).default;
   const c=await config();assert.equal(c.locale,code);assert.ok(c.messages.AccountUI.a101);
  }
 });
}
test('Danish, Ukrainian, Finnish and Czech quantities use native singular, plural and fractional forms',()=>{
 const cases={hu:[[1,'1 éjszaka'],[2,'2 éjszaka']],bg:[[1,'1 нощ'],[2,'2 нощи']],sk:[[1,'1 noc'],[2,'2 noci'],[5,'5 nocí'],[1.5,'1,5 noci']],el:[[1,'1 νύχτα'],[2,'2 νύχτες']],da:[[1,'1 nat'],[2,'2 nætter']],uk:[[1,'1 ніч'],[2,'2 ночі'],[5,'5 ночей'],[11,'11 ночей'],[21,'21 ніч'],[22,'22 ночі'],[1.5,'1,5 ночі']],fi:[[1,'1 yö'],[2,'2 yötä']],cs:[[1,'1 noc'],[2,'2 noci'],[5,'5 nocí'],[21,'21 nocí'],[1.5,'1,5 noci']]};
 for(const[locale,rows]of Object.entries(cases)){
  const t=createTranslator({locale,messages:JSON.parse(read(`messages/${locale}.json`))});
  for(const[count,expected]of rows)assert.ok(t('ProjectUI.nightlyCalculation',{count,price:'€400'}).startsWith(expected));
 }
});
test('Consolidated Auth review templates cover twenty-four languages with exact links and unchanged English fallback',()=>{
 for(const stem of ['mzs-confirm-signup-email-template','mzs-staging-reset-password-email-template']){
  const original=read(`docs/${stem}.html`),all=read(`docs/${stem}-twenty-four-languages.html`);
  const[prefix,fallback]=all.split('{{ else }}\n');assert.equal(fallback,original+'{{ end }}\n');
  assert.deepEqual([...prefix.matchAll(/eq .Data.preferred_language "([^"]+)"/g)].map(m=>m[1]),order.slice(1));
  const hrefs=s=>[...s.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  for(const code of [...codes,'tr']){
   const body=read(`docs/${stem}-${code}.html`);assert.ok(body.includes(`lang="${code}"`));assert.deepEqual(hrefs(body),hrefs(original));
   if(stem.includes('reset'))assert.ok(body.includes('8'));
  }
 }
});
test('New-language country labels and order remain stable even if the runtime ICU differs',()=>{
 const exports={},stable=JSON.parse(read('lib/european-country-names.json'));
 vm.runInNewContext(ts.transpileModule(read('lib/contact-inputs.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,Intl:{DisplayNames:class{constructor(){throw Error('Runtime-dependent names must not render new-language options');}}},
  require:n=>n==='libphonenumber-js'?phone:{default:stable}
 });
 for(const code of codes){
  const options=exports.countryOptions(code);assert.equal(options.length,contacts.countryCodes.length);
  assert.deepEqual(JSON.parse(JSON.stringify(options)),stable[code].filter(x=>contacts.countryCodes.includes(x.code)));
  assert.equal(exports.countryName('HK',code),stable[code].find(x=>x.code==='HK').name);
  assert.ok(!exports.countryOptions(code,true).some(x=>x.code==='AQ'));
  assert.deepEqual(Array.from(exports.countryOptions(code,true),x=>x.code).sort(),phone.getCountries().sort());
  assert.deepEqual(Array.from(options,x=>x.code).sort(),Array.from(contacts.countryCodes).sort());
 }
});
test('Production sitemap includes all 120 marketing routes and preview stays non-indexable',()=>{
 for(const environment of ['production','preview']){
  const exports={};vm.runInNewContext(ts.transpileModule(read('app/sitemap.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,process:{env:{VERCEL_ENV:environment}},require:()=>routing});
  const entries=exports.default();assert.equal(entries.length,environment==='production'?120:0);
  if(environment==='production')for(const l of codes)assert.ok(entries.some(e=>e.url===`https://www.mzsgroup.com/${l}/consultancy`));
 }
});
