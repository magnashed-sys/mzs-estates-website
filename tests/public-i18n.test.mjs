import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
const code = ts.transpileModule(readFileSync(new URL('../i18n/public-routing.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const routing = {}; vm.runInNewContext(code, {exports: routing});
const catalogs = Object.fromEntries(routing.locales.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)))]));
test('Marketing and login routes are localized; private and machine route aliases stay excluded', () => {
  for (const locale of routing.locales) for (const path of routing.localizedPaths) {
    const result = routing.publicRoute(routing.localizedPath(path, locale));
    assert.equal(result.locale, locale); assert.equal(result.path, path);
  }
  for (const path of ['/admin', '/private', '/auth/confirm', '/api/intro-calls', '/api/rental/notifications/dispatch', '/reset-password', '/nl/private', '/es/admin', '/fr', '/es/api/intro-calls', '/nl/real-estate/extra']) assert.equal(routing.publicRoute(path), null);
});
test('Locale links preserve existing English URLs and never create private aliases', () => {
  assert.equal(routing.localizedPath('/real-estate', 'en'), '/real-estate');
  assert.equal(routing.localizedPath('/', 'nl'), '/nl');
  for (const path of ['/private', '/api/intro-calls']) assert.equal(routing.localizedPath(path, 'es'), path);
  assert.equal(routing.localizedPath('/login', 'es'), '/es/login');
  assert.equal(routing.languageAlternates('/private-capital')['x-default'], '/private-capital');
});
test('All translation catalogues are complete and every ICU message renders without errors', () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    const expected = locale === 'ru' ? Object.fromEntries(Object.keys(messages).map(key => [key, catalogs.en[key]])) : catalogs.en;
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(expected).sort());
    const errors = [];
    const t = createTranslator({locale, messages, onError: error => errors.push(error)});
    function check(expected, actual, prefix = '') {
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
      for (const [key, value] of Object.entries(expected)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object') { check(value, actual[key], path); continue; }
        assert.ok(actual[key].trim());
        const rendered = t(path, {brand: 'MZS Estates', address: 'test@example.invalid', title: 'Test project', id: 'test-reference', name: 'Test company', message: 'Saved', start: '1 Jan', end: '3 Jan', explanation: 'Test', date: '1 Jan', count: 2, bedrooms: 2, bathrooms: 1, price: '€400', index: 1, total: 5, caption: 'Photo', kind: 'investment', role: 'Client'});
        assert.ok(rendered.length > 0);
      }
    }
    check(expected, messages);
    assert.deepEqual(errors, [], `${locale}: ${errors.map(error => error.message).join(', ')}`);
  }
});

test('Project client catalogue includes UI copy but excludes server-only loan/project narratives', () => {
  const keySource = readFileSync(new URL('../i18n/project-client-keys.ts', import.meta.url), 'utf8');
  const keys = new Set([...keySource.matchAll(/"([^"]+)"/g)].map(match => match[1]));
  for (const name of ['AmsterdamFlorawegInvestment', 'ConfiguredRentalCalendar', 'RentalCalendar', 'ProjectResources', 'PropertyGallery', 'PropertyWalkthrough']) {
    const source = readFileSync(new URL(`../app/private/projects/[slug]/${name}.tsx`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\bt\("([^"]+)"/g)) assert.ok(keys.has(match[1]), `${name}: missing client key ${match[1]}`);
  }
  for (const key of ['investmentKind', 'acquisitionKind', 'documentCategories']) assert.ok(keys.has(key));
  const photoSource = readFileSync(new URL('../app/private/projects/[slug]/localizedPhotoChapters.ts', import.meta.url), 'utf8');
  for (const match of photoSource.matchAll(/: "(p\d+)"/g)) assert.ok(keys.has(match[1]));
  for (const key of keys) for (const locale of ['en', 'nl', 'es']) assert.ok(catalogs[locale].ProjectUI[key]);
  for (const privateKey of ['p223', 'p240', 'p247', 'p286', 'p297', 'p447', 'p449', 'p451', 'p453', 'p454', 'loanTerm', 'loanMinimum']) assert.ok(!keys.has(privateKey), privateKey);
});

test('Account language does not create aliases for one-time security routes',()=>{
 for(const path of routing.accountPaths){assert.equal(routing.isAccountPath(path),true);for(const locale of routing.locales)assert.equal(routing.localizedPath(path,locale),path);}
 for(const path of ['/auth/confirm','/api/account/register','/admin','/nl/reset-password'])assert.equal(routing.isAccountPath(path),false);
});
test('Every public registration error has a translated message, including partial-created warnings',()=>{
 const source=readFileSync(new URL('../i18n/registration-errors.ts',import.meta.url),'utf8');
 const errors={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:errors});
 const api=readFileSync(new URL('../app/api/account/register/route.ts',import.meta.url),'utf8');
 for(const match of api.matchAll(/error: "([^"]+)"/g)) {const key=errors.registrationErrorKey(match[1]);assert.notEqual(key,'a071',match[1]);for(const locale of routing.locales)assert.ok(catalogs[locale].AccountUI[key]);}
 for(const message of ['<unexpected backend details>',null,'__proto__'])assert.equal(errors.registrationErrorKey(message),'a071');
});
