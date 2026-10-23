import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, Intl, require: name => dependencies[name] });
  return exports;
}
const { rentSummary } = load('../lib/estates/rent.ts');

test('rent totals sum cents and annualise the recorded monthly rent', () => {
  const totals = rentSummary([{ monthly_rent: '500.01', utilities_advance: 50.03 }, { monthly_rent: 400.02, utilities_advance: '30.01' }]);
  assert.equal(totals.monthly, 900.03);
  assert.equal(totals.annual, 10800.36);
  assert.equal(totals.utilitiesAdvance, 80.04);
});
test('an unknown utilities advance is never presented as zero', () => {
  assert.equal(rentSummary([{ monthly_rent: 500, utilities_advance: null }]).utilitiesAdvance, null);
  assert.equal(rentSummary([{ monthly_rent: 500, utilities_advance: 0 }]).utilitiesAdvance, 0);
  assert.equal(rentSummary([]).utilitiesAdvance, null);
});

function guard({ isolated = true, profile = { role: 'admin', is_active: true }, user = { id: 'test' }, authError = null, profileError = null } = {}) {
  let connections = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile, error: profileError }) }) }) }),
  };
  const module = load('../lib/security/estate-properties.ts', {
    'next/navigation': { notFound: () => { throw Error('404'); }, redirect: () => { throw Error('login'); } },
    '../supabase/server': { createClient: async () => { connections++; return db; } },
    './phase3a-preview-isolation': { isPhase3aPreviewIsolated: () => isolated },
  });
  return { run: module.requireEstateAdmin, connections: () => connections };
}
test('Preview connected to Production is rejected before database access', async () => {
  const g = guard({ isolated: false });
  await assert.rejects(g.run(), /404/);
  assert.equal(g.connections(), 0);
});
test('active full administrator alone may open the property register', async () => {
  assert.equal((await guard().run()).user.id, 'test');
  for (const profile of [null, { role: 'client', is_active: true }, { role: 'capital_admin', is_active: true }, { role: 'admin', is_active: false }]) {
    await assert.rejects(guard({ profile }).run(), /404/);
  }
  await assert.rejects(guard({ profileError: new Error('offline') }).run(), /404/);
  await assert.rejects(guard({ user: null }).run(), /login/);
  await assert.rejects(guard({ authError: new Error('expired') }).run(), /login/);
});
