import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {createTranslator} from 'next-intl';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const codes=['pl','zh-CN','sv','ro','nb'];
const mail={};vm.runInNewContext(ts.transpileModule(read('lib/mzs/localized-account-mail.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mail});
const visits={};vm.runInNewContext(ts.transpileModule(read('lib/mzs/visitor-report.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:visits});
const rental=JSON.parse(read('lib/mzs/rental-mail-copy.json'));
for(const code of codes){
 test(`${code}: account emails retain safe destinations, escaped names and financial privacy`,()=>{
  assert.ok(mail.isLocalizedAccountLocale(code));
  for(const [event_type,path] of [['account_activated',`/${code}/login`],['new_project_access','/private'],['capital_access_granted','/private/capital']]){
   const m=mail.localizedAccountMail({event_type,payload:{projects:['<script>example</script>'],project:'<script>example</script>',amount:987654321,borrower:'PRIVATE-BORROWER'}},'<img onerror=x>',code,'https://example.invalid');
   assert.ok(m.html.includes(`href="https://example.invalid${path}"`));
   assert.ok(m.html.includes(`lang="${code}" dir="ltr"`));
   assert.doesNotMatch(m.html,/<script>|<img|987654321|PRIVATE-BORROWER/);
  }
 });
 test(`${code}: prepared Auth templates preserve token URLs and eight-character policy`,()=>{
  for(const [base,token] of [['mzs-confirm-signup-email-template','{{ .ConfirmationURL }}'],['mzs-staging-reset-password-email-template','{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery']]){
   const standalone=read(`docs/${base}-${code}.html`),combined=read(`docs/${base}-expanded-languages.html`);
   assert.ok(standalone.includes(`lang="${code}"`));assert.ok(standalone.includes(`href="${token}"`));
   assert.ok(combined.includes(`{{ else if eq .Data.preferred_language "${code}" }}`));assert.ok(combined.includes('{{ else }}'));assert.ok(combined.includes('<html lang="en"'));
   if(base.includes('reset'))assert.ok(standalone.includes('8'));
  }
 });
 test(`${code}: rental copy is complete and public visits stay token-free`,()=>{
  for(const section of ['title','intro','status','labels'])assert.deepEqual(Object.keys(rental[code][section]).sort(),Object.keys(rental.lt[section]).sort());
  assert.notEqual(rental[code].status.requested,rental[code].status.confirmed);
  assert.notEqual(rental[code].intro.cancelled,rental[code].intro.confirmed);
  assert.equal(visits.visitorPath(`/${code}/real-estate`),'/real-estate');
  assert.equal(visits.visitorPath(`/${code}/auth/confirm?token_hash=secret`),null);
 });
}
test('Native quantity forms handle Polish, Romanian, Swedish and Chinese rules',()=>{
 const cases={nb:[[1,'1 natt'],[2,'2 netter']],pl:[[1,'1 noc'],[2,'2 noce'],[5,'5 nocy'],[12,'12 nocy'],[22,'22 noce']],ro:[[1,'1 noapte'],[2,'2 nopți'],[19,'19 nopți'],[20,'20 de nopți']],sv:[[1,'1 natt'],[2,'2 nätter']], 'zh-CN':[[1,'1 晚'],[2,'2 晚']]};
 for(const[locale,rows]of Object.entries(cases)){
  const t=createTranslator({locale,messages:JSON.parse(read(`messages/${locale}.json`))});
  for(const[count,expected]of rows)assert.ok(t('ProjectUI.nightlyCalculation',{count,price:'123,45 €'}).startsWith(expected));
  assert.match(t('AccountUI.a083'),/8/);
 }
});
