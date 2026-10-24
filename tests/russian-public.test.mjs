import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const routing = {};
vm.runInNewContext(ts.transpileModule(read('i18n/public-routing.ts'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:routing});

test('Russian public paths roundtrip and security/private paths never gain aliases', () => {
  for (const path of routing.localizedPaths) {
    const result = routing.publicRoute(routing.localizedPath(path,'ru'));
    assert.equal(result.locale,'ru'); assert.equal(result.path,path);
  }
  for (const path of ['/private','/admin','/api/account/register','/auth/confirm','/reset-password','/accept-invitation']) {
    assert.equal(routing.publicRoute('/ru'+path),null);
    assert.equal(routing.localizedPath(path,'ru'),path);
  }
  assert.equal(routing.languageAlternates('/real-estate').ru,'/ru/real-estate');
  assert.equal(routing.publicRoute('/rubbish'),null);
});
test('Russian member locale follows cookie or saved preference; unsupported values fall back',()=>{
  for(const value of [undefined,null,'xx']) assert.equal(routing.memberLocale(value),'en');
  for(const value of ['en','nl','es','ru']) assert.equal(routing.memberLocale(value),value);
  const source=read('i18n/request.ts');
  assert.match(source,/requested = memberLocale\(cookie\)/);
  assert.match(source,/requested = memberLocale\(saved\)/);
  assert.match(read('app/components/LanguageSwitcher.tsx'),/account \? memberLocales : locales/);
});
