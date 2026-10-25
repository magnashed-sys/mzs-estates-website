import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url), api={};
new Function('exports','require',ts.transpileModule(readFileSync('lib/contact-inputs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(api,require);
test('country choices include address-only territories and preserve localized legacy recognition',()=>{
 for(const code of ['NL','ES','AE','GB','US','BR','AQ','BV','HM','TF','UM','XK'])assert.ok(api.countryCodes.includes(code));
 assert.equal(new Set(api.countryCodes).size,api.countryCodes.length);
 for(const [input,code] of [['Nederland','NL'],['España','ES'],['UAE','AE'],['United Arab Emirates','AE'],['UK','GB'],['Deutschland','DE'],['البرازيل','BR'],['  nl  ','NL']])assert.equal(api.countryCode(input),code);
 assert.equal(api.countryCode('An old custom address country'),undefined);
 assert.equal(api.countryName('NL','nl'),'Nederland');
 for(const locale of ['en','nl','es','ru','de','it','fr','pt-BR','ar'])assert.ok(api.countryOptions(locale).every(o=>o.name));
});
test('international phone entry handles national trunks, significant Italian zero, shared codes and pasting',()=>{
 for(const [number,country,expected] of [['0612345678','NL','+31612345678'],['612345678','ES','+34612345678'],['0501234567','AE','+971501234567'],['02079460018','GB','+442079460018'],['0212345678','IT','+390212345678'],['11961234567','BR','+5511961234567'],['4165550123','CA','+14165550123'],['2025550123','US','+12025550123'],['0031612345678','ES','+31612345678'],['+31 (0)6 12345678','ES','+31612345678'],['٠٥٠١٢٣٤٥٦٧','AE','+971501234567']]){
  const result=api.editPhone(number,country);assert.equal(result.error,'',number);assert.equal(result.value,expected,number);
 }
 assert.equal(api.editPhone('+31612345678','ES').country,'NL');
 assert.equal(api.editPhone('+80012345678','').country,'+800');
 assert.equal(api.editPhone('02079460018 ext. 123','GB').value,'+442079460018 ext. 123');
});
test('empty and existing phone values are retained; editing requires a possible full number',()=>{
 for(const legacy of ['0612 345678','Call reception','+31 (0)6 12345678','']){
  const split=api.splitPhone(legacy);assert.equal(split.value,legacy);assert.equal(split.error,'');
 }
 assert.equal(api.splitPhone('0612 345678').country,'');
 assert.equal(api.splitPhone('+31612345678').country,'NL');
 assert.equal(api.editPhone('','NL').value,'');
 assert.equal(api.editPhone('612345678','').error,'chooseCode');
 for(const number of ['1','call +31612345678','+99912345678','1234567890123456789012345'])assert.equal(api.editPhone(number,'NL').error,'invalidPhone');
});
test('shared form labels are complete in every platform language',()=>{
 const keys=Object.keys(JSON.parse(readFileSync('messages/en.json','utf8')).ContactInput).sort();
 for(const locale of ['nl','es','ru','de','it','fr','pt-BR','ar']){
  const copy=JSON.parse(readFileSync(`messages/${locale}.json`,'utf8')).ContactInput;
  assert.deepEqual(Object.keys(copy).sort(),keys);assert.ok(Object.values(copy).every(Boolean));
 }
});
