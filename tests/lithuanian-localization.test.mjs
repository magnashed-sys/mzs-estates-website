import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {parse} from '@formatjs/icu-messageformat-parser';
import {createTranslator} from 'next-intl';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lt=JSON.parse(read('messages/lt.json'));
const en=JSON.parse(read('messages/en.json'));
const routing={};
vm.runInNewContext(ts.transpileModule(read('i18n/public-routing.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:routing});
const vars=(ast,out=new Set())=>{
 for(const node of ast){
  if([1,2,3,4,5,6].includes(node.type))out.add(node.value);
  if(node.options)for(const opt of Object.values(node.options))vars(opt.value,out);
  if(node.children)vars(node.children,out);
 }
 return [...out].sort();
};
test('Lithuanian translations cover the entire English catalogue and ICU variable list',()=>{
 let count=0; const scan=(a,b,path='')=>{
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);
  for(const key of Object.keys(a)){
   if(typeof a[key]==='object')scan(a[key],b[key],path+'.'+key);
   else {
    count++;
    assert.equal(typeof b[key],'string',path+'.'+key);
    assert.ok(b[key].trim(),path+'.'+key);
    assert.deepEqual(vars(parse(a[key])),vars(parse(b[key])),path+'.'+key);
   }
  }
 };
 scan(en,lt);assert.equal(count,1132);
});
test('Lithuanian route is a public-only prefix and preserves all protected paths',()=>{
 assert.equal(routing.memberLocale('lt'),'lt');
 assert.equal(routing.localeDirection('lt'),'ltr');
 for(const path of ['/', '/real-estate', '/private-capital','/login']){
  assert.equal(routing.localizedPath(path,'lt'),'/lt'+(path==='/'?'':path));
  const resolved=routing.publicRoute(routing.localizedPath(path,'lt'));
  assert.deepEqual({...resolved},{locale:'lt',path});
 }
 for(const path of ['/private','/private/projects/villa-la-nucia','/admin','/api/account/register','/reset-password','/auth/confirm'])
  assert.equal(routing.localizedPath(path,'lt'),path);
 assert.equal(routing.publicRoute('/lt/admin'),null);
 assert.equal(routing.publicRoute('/lt/private'),null);
 assert.equal(routing.languageAlternates('/real-estate').lt,'/lt/real-estate');
 assert.match(read('i18n/metadata.ts'),/lt: 'lt_LT'/);
 const languageMenu=read('app/components/LanguageSwitcher.tsx');
 assert.match(languageMenu,/lt: 'Lietuvių'/);
 assert.match(languageMenu,/lt: '🇱🇹'/);
});
test('Critical Lithuanian actions, security and booking labels have actual translations',()=>{
 for(const [namespace,keys] of Object.entries({
  Header:['login','request_access','real_estate'],
  Login:['password','forgot','inactive'],
  Language:['choose','saving','save_failed'],
  RentalAccount:['title','contracts','invoices'],
  ContactInput:['callingCode','invalidPhone']
 }))for(const key of keys)assert.notEqual(lt[namespace][key],en[namespace][key],namespace+'.'+key);
 const errors=[];const t=createTranslator({locale:'lt',messages:lt,onError:e=>errors.push(e)});
 assert.match(t('CapitalUI.received',{id:'LT-DEMO-01'}),/LT-DEMO-01/);
 for(const n of [0,1,2,5,11,21,100,1.5])
  assert.ok(t('ProjectUI.minimumStay',{count:n}).length>5);
 assert.deepEqual(errors,[]);
});
test('Lithuanian booking messages include financial and date formatting without changing records',()=>{
 const copy=JSON.parse(read('lib/mzs/rental-mail-copy.json'));
 assert.deepEqual(Object.keys(copy.lt).sort(),Object.keys(copy.tr).sort());
 for(const kind of ['requested','confirmed','modified','cancelled']){
  assert.ok(copy.lt.intro[kind].length>35);
  assert.ok(copy.lt.title[kind].length>10);
 }
 const account=read('lib/mzs/localized-account-mail.ts');
 assert.match(account,/lt: \{/);
 assert.match(account,/Jūsų MZS Group paskyra aktyvuota/);
});

test('Prepared Lithuanian Auth templates retain exact verification/recovery links and English fallback',()=>{
 for(const [base,lt,combined] of [
 ['mzs-confirm-signup-email-template','mzs-confirm-signup-email-template-lt','mzs-confirm-signup-email-template-all-languages-plus-lt'],
 ['mzs-staging-reset-password-email-template','mzs-staging-reset-password-email-template-lt','mzs-staging-reset-password-email-template-all-languages-plus-lt']
 ]){
  const original=read('docs/'+base+'.html');
  const languageTemplate=read('docs/'+lt+'.html');
  const compound=read('docs/'+combined+'.html');
  const urls=s=>[...s.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(urls(languageTemplate),urls(original));
  assert.match(languageTemplate,/<html lang="lt">/);
  assert.match(compound,/else if eq \.Data\.preferred_language "lt"/);
  assert.ok(compound.includes(languageTemplate));
  const fallback=compound.split('{{ else }}\n')[1];
  assert.equal(fallback,original+'{{ end }}\n');
 }
});
