import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@formatjs/icu-messageformat-parser';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const en=JSON.parse(read('messages/en.json')),ru=JSON.parse(read('messages/ru.json'));
function args(nodes,out=new Set()) {
 for(const n of nodes){if([1,2,3,4,5,6].includes(n.type))out.add(n.value);if(n.options)for(const option of Object.values(n.options))args(option.value,out);if(n.children)args(n.children,out);}
 return [...out].sort();
}
test('Every Russian message preserves ICU arguments, including nested catalogues',()=>{
 function check(a,b,path=''){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const key of Object.keys(a)){
  if(typeof a[key]==='object')check(a[key],b[key],path+key+'.');
  else assert.deepEqual(args(parse(a[key])),args(parse(b[key])),path+key);
 }}check(en,ru);
});
test('Russian project counts render one, few and many with actual numbers',()=>{
 const t=createTranslator({locale:'ru',messages:ru,namespace:'ProjectUI'});
 for(const [count,word] of [[1,'ночь'],[2,'ночи'],[5,'ночей'],[21,'ночь'],[22,'ночи']])
  assert.match(t('minimumStay',{count}),new RegExp(count+' '+word));
});
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
const {russianRentalMail}=load('lib/mzs/russian-rental-mail.ts');
const {localizedAccountMail}=load('lib/mzs/localized-account-mail.ts');
test('Russian rental snapshots distinguish requests, confirmations, changes and cancellations',()=>{
 const booking={property:'Villa <script>x</script>',checkIn:'2026-12-01',checkOut:'2026-12-04',guests:2,total:300,reference:'fixture',notes:'<img onerror=x>',heating:false};
 for(const kind of ['requested','confirmed','modified','cancelled']){
  const m=russianRentalMail(kind,booking,'https://staging.example.invalid');
  assert.match(m.html,/lang="ru"/);assert.doesNotMatch(m.html,/<script>|<img/);assert.match(m.html,/&lt;script&gt;/);
  assert.match(m.text,/1 декабря 2026/);assert.match(m.text,/Ночей: 3/);assert.match(m.text,/https:\/\/staging.example.invalid\/private\/reservations/);
  if(kind==='requested'){assert.match(m.text,/ещё не подтверждено/);assert.match(m.text,/подогрев бассейна: Нет/);}
  if(kind==='cancelled')assert.match(m.text,/возврата средств решаются отдельно/);
 }
});
test('Russian account notifications escape data and capital mail never leaks financial payload',()=>{
 for(const event_type of ['account_activated','new_project_access','capital_access_granted']){
  const m=localizedAccountMail({event_type,payload:{projects:['<script>x</script>'],project:'<script>x</script>',added_types:['rental'],amount:'SECRET_MONEY'}},'<img>','ru','https://staging.example.invalid');
  assert.match(m.html,/lang="ru"/);assert.doesNotMatch(m.html,/<script>|<img>|SECRET_MONEY/);
  if(event_type==='account_activated')assert.match(m.text,/\/ru\/login/);
  if(event_type==='capital_access_granted')assert.doesNotMatch(m.text,/script|SECRET_MONEY/);
 }
});
test('Prepared bilingual auth templates keep exact existing token URLs and English fallback',()=>{
 for(const stem of ['mzs-confirm-signup-email-template','mzs-staging-reset-password-email-template']){
  const original=read('docs/'+stem+'.html'), template=read('docs/'+stem+'-ru-en.html');
  const [russian,english]=template.split('{{ else }}\n');
  assert.equal(english,original+'{{ end }}\n');
  assert.ok(russian.startsWith('{{ if eq .Data.preferred_language "ru" }}'));
  const hrefs=s=>[...s.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(hrefs(russian),hrefs(original));
 }
});
