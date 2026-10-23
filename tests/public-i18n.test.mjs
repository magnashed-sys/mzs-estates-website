import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
const code = ts.transpileModule(readFileSync(new URL('../i18n/public-routing.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
const routing = {}; vm.runInNewContext(code, {exports: routing});
const catalogs = Object.fromEntries(['en', 'nl', 'es'].map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)))]));
test('Only the nine public language routes are localized; private and machine routes stay excluded', () => {
  for (const locale of routing.locales) for (const path of routing.publicPaths) {
    const result = routing.publicRoute(routing.localizedPath(path, locale));
    assert.equal(result.locale, locale); assert.equal(result.path, path);
  }
  for (const path of ['/login', '/admin', '/private', '/auth/confirm', '/api/intro-calls', '/api/rental/notifications/dispatch', '/reset-password', '/nl/private', '/es/admin', '/nl/login', '/fr', '/es/api/intro-calls', '/nl/real-estate/extra']) assert.equal(routing.publicRoute(path), null);
});
test('Locale links preserve existing English URLs and never create private aliases', () => {
  assert.equal(routing.localizedPath('/real-estate', 'en'), '/real-estate');
  assert.equal(routing.localizedPath('/', 'nl'), '/nl');
  for (const path of ['/login', '/private', '/api/intro-calls']) assert.equal(routing.localizedPath(path, 'es'), path);
  assert.equal(routing.languageAlternates('/private-capital')['x-default'], '/private-capital');
});
test('All translation catalogues are complete and every ICU message renders without errors', () => {
  for (const [locale, messages] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(catalogs.en).sort());
    const errors = [];
    const t = createTranslator({locale, messages, onError: error => errors.push(error)});
    for (const [namespace, values] of Object.entries(catalogs.en)) {
      assert.deepEqual(Object.keys(messages[namespace]).sort(), Object.keys(values).sort());
      for (const key of Object.keys(values)) {
        assert.ok(messages[namespace][key].trim());
        const rendered = t(`${namespace}.${key}`, {brand: 'MZS Estates', address: 'test@example.invalid'});
        assert.ok(rendered.length > 0);
      }
    }
    assert.deepEqual(errors, [], `${locale}: ${errors.map(error => error.message).join(', ')}`);
  }
});
