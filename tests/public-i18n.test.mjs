import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
const code = ts.transpileModule(readFileSync(new URL('../i18n/public-routing.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const routing = {}; vm.runInNewContext(code, {exports: routing});
const catalogs = Object.fromEntries(['en', 'nl', 'es'].map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)))]));
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
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(catalogs.en).sort());
    const errors = [];
    const t = createTranslator({locale, messages, onError: error => errors.push(error)});
    function check(expected, actual, prefix = '') {
      assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
      for (const [key, value] of Object.entries(expected)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object') { check(value, actual[key], path); continue; }
        assert.ok(actual[key].trim());
        const rendered = t(path, {brand: 'MZS Estates', address: 'test@example.invalid', title: 'Test project', id: 'test-reference', name: 'Test company', message: 'Saved', start: '1 Jan', end: '3 Jan', explanation: 'Test', date: '1 Jan'});
        assert.ok(rendered.length > 0);
      }
    }
    check(catalogs.en, messages);
    assert.deepEqual(errors, [], `${locale}: ${errors.map(error => error.message).join(', ')}`);
  }
});
