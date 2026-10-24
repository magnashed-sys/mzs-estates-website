import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(name){assert.ok(Object.hasOwn(deps,name),name);return deps[name];}});return exports;}
const russian=load('lib/mzs/russian-rental-mail.ts');
const copy=JSON.parse(read('lib/mzs/rental-mail-copy.json'));
const {localizedRentalMail,isLocalizedRentalLocale}=load('lib/mzs/localized-rental-mail.ts',{'./russian-rental-mail':russian,'./rental-mail-copy.json':{default:copy}});
const {isLocalizedAccountLocale}=load('lib/mzs/localized-account-mail.ts');
test('Every translated rental snapshot preserves dates, amounts, request/confirmation distinction and cancellation disclaimer',()=>{
 const b={property:'Villa <script>x</script>',checkIn:'2026-12-01',checkOut:'2026-12-04',guests:2,total:300.5,reference:'REF-123',notes:'<img onerror=x>',heating:false};
 for(const locale of Object.keys(copy))for(const kind of ['requested','confirmed','modified','cancelled']) {
  const c=copy[locale], m=localizedRentalMail(kind,b,'https://staging.example.invalid',locale);
  assert.ok(m.text.includes(c.intro[kind]));assert.ok(m.text.includes(c.status[kind]));
  assert.ok(m.text.includes(new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date('2026-12-01T12:00:00Z'))));
  assert.ok(m.text.includes(new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(300.5)));
  assert.ok(m.text.includes(kind==='cancelled'?c.cancelFooter:c.footer));
  assert.match(m.html,/href="https:\/\/staging.example.invalid\/private\/reservations"/);
  assert.doesNotMatch(m.html,/<script>|<img/);assert.match(m.html,/&lt;script&gt;/);
  assert.match(m.html,new RegExp('dir="'+(locale==='ar'?'rtl':'ltr')+'"'));
  if(kind==='requested'){assert.ok(m.text.includes(c.labels.heating+': '+c.no));assert.match(m.text,/<img onerror=x>/);}
  else assert.doesNotMatch(m.text,/<img/);
 }
});
test('Untrusted language metadata cannot select inherited object properties or change behavior',()=>{
 for(const invalid of ['__proto__','constructor','toString','pt','pt-PT',null,{},['ar']]) {
  assert.equal(isLocalizedRentalLocale(invalid),false);assert.equal(isLocalizedAccountLocale(invalid),false);
 }
});
test('Prepared auth templates cover eight translations with exact token URLs and unchanged English fallback',()=>{
 for(const stem of ['mzs-confirm-signup-email-template','mzs-staging-reset-password-email-template']) {
  const original=read('docs/'+stem+'.html'), template=read('docs/'+stem+'-all-languages.html');
  const [translated,fallback]=template.split('{{ else }}\n');assert.equal(fallback,original+'{{ end }}\n');
  const branches=translated.split(/\{\{ (?:else )?if eq \.Data\.preferred_language "[^"]+" \}\}\n/).filter(Boolean);
  assert.equal(branches.length,8);
  const hrefs=s=>[...s.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  for(const body of branches)assert.deepEqual(hrefs(body),hrefs(original));
  for(const lang of ['nl','es','ru','de','it','fr','pt-BR','ar'])assert.ok(translated.includes('lang="'+lang+'"'));
  assert.match(translated,/<html lang="ar" dir="rtl">/);
 }
});
