// Execute the real server page/component code with explicit synthetic query
// responses. This is a rendering/authorization unit test, not a live login test.
// Actual Supabase RLS is covered by supabase/tests/can_juan_access_staging.sql.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const slug = 'villa-can-juan-ibiza';
const staging = 'https://senonkpxdtlhyhrubicg.supabase.co';
const production = 'https://ptrnjzmcehrhbsfxntgw.supabase.co';
const pagePath = 'app/private/projects/[slug]/page.tsx';
const previewPath = 'app/admin/group/investment-preview/page.tsx';
const realModules = new Set([
  pagePath, previewPath, 'app/private/projects/[slug]/VillaCanJuanInvestment.tsx',
  'app/components/projects/ProjectTimeline.tsx', 'app/components/projects/IbizaLoanTerms.tsx',
  'lib/security/phase3a-preview-isolation.ts',
]);

function fixture(options = {}) {
  const types = options.types ?? ['investment'];
  const user = options.anonymous ? null : { id: 'member' };
  const profile = { id: 'member', role: options.role ?? 'client', is_active: !options.inactive };
  const project = { id: 'project', slug, title: 'Synthetic project', status: options.projectStatus ?? 'active' };
  const offerings = types.map((type, i) => ({
    id: `offering-${i}`, project_id: options.otherProject ? 'unrelated' : project.id,
    offering_type: type, status: options.offeringStatus ?? 'active',
  }));
  const rows = {
    profiles: options.missingProfile ? [] : [profile],
    projects: [project],
    project_access: options.noProjectGrant ? [] : [{ user_id: 'member', project_id: project.id }],
    offering_access: offerings.map(o => ({ user_id: 'member', offering_id: o.id })),
    offerings, project_content: [],
  };
  let connections = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: options.authError ? new Error('auth') : null }) },
    from(table) {
      assert.ok(Object.hasOwn(rows, table), `Unexpected database query: ${table}`);
      let result = rows[table];
      const query = {
        select() { return query; },
        eq(key, value) { result = result.filter(row => row[key] === value); return query; },
        in(key, values) { result = result.filter(row => values.includes(row[key])); return query; },
        order() { return query; },
        async single() { return response(result[0] ?? null); },
        async maybeSingle() { return response(result[0] ?? null); },
        then(ok, fail) { return Promise.resolve(response(result)).then(ok, fail); },
      };
      function response(data) { return { data, error: options.errorTable === table ? new Error('query') : null }; }
      return query;
    },
  };
  return { async createClient() { connections++; return client; }, connections: () => connections };
}

function load(relativePath, db, env, cache = new Map()) {
  const filename = resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  function scopedRequire(name) {
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'next/navigation') return {
      notFound() { throw new Error('NOT_FOUND'); },
      redirect(url) { throw new Error(`REDIRECT:${url}`); },
    };
    if (name.endsWith('/supabase/server')) return { createClient: db.createClient };
    if (name === 'next/image') return () => null;
    if (name === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
    if (name.endsWith('.module.css')) return {};
    const path = resolve(dirname(filename), name);
    if (name.endsWith('.json')) return JSON.parse(readFileSync(path, 'utf8'));
    for (const suffix of ['.ts', '.tsx']) {
      const relative = (path + suffix).slice(root.length + 1);
      if (realModules.has(relative)) return load(relative, db, env, cache);
    }
    // Galleries, calendars and unrelated projects do not decide access and are
    // outside this rendering test. Reject any other unexpected dependency.
    if (/^\.\/(RentalCalendar|ConfiguredRentalCalendar|PropertyGallery|ProjectResources|PropertyWalkthrough|VillaDesColomsInvestment|AmsterdamFlorawegInvestment)$/.test(name)) return () => null;
    throw new Error(`Unexpected import ${name} from ${relativePath}`);
  }
  vm.runInNewContext(output, { exports: module.exports, module, require: scopedRequire, process: { env } }, { filename });
  return module.exports;
}

async function renderPage(options = {}, env = { VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: staging }, path = pagePath) {
  const db = fixture(options);
  const page = load(path, db, env).default;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ slug }) }));
}

for (const environment of ['preview', 'production']) {
  for (const [name, types, investment, acquisition] of [
    ['investment only', ['investment'], true, false],
    ['acquisition only', ['sale'], false, true],
    ['both offerings', ['investment', 'sale'], true, true],
  ]) {
    test(`${environment}: ${name} preserves presentation and offering separation`, async () => {
      const html = await renderPage({ types }, { VERCEL_ENV: environment, NEXT_PUBLIC_SUPABASE_URL: environment === 'preview' ? staging : production });
      assert.ok(html.includes('From location to completion.'));
      assert.ok(html.includes('Q4 2027'));
      for (const term of ['A defined lending opportunity.', '10%', '€6,200,000', 'REQUEST INVESTMENT DETAILS', 'Optional follow-on financing']) {
        assert.equal(html.includes(term), investment, term);
      }
      assert.equal(html.includes('ENQUIRE ABOUT ACQUISITION'), acquisition);
    });
  }
}

for (const [name, options, error] of [
  ['anonymous', { anonymous: true }, /REDIRECT:\/login/],
  ['invalid session', { authError: true }, /REDIRECT:\/login/],
  ['inactive account', { inactive: true }, /NOT_FOUND/],
  ['missing profile', { missingProfile: true }, /NOT_FOUND/],
  ['no project grant', { noProjectGrant: true }, /NOT_FOUND/],
  ['no offering grant', { types: [] }, /NOT_FOUND/],
  ['another project offering', { otherProject: true }, /NOT_FOUND/],
  ['inactive project', { projectStatus: 'draft' }, /NOT_FOUND/],
  ['inactive offering', { offeringStatus: 'draft' }, /NOT_FOUND/],
  ...['profiles', 'projects', 'project_access', 'offering_access', 'offerings', 'project_content'].map(table => [`${table} query error`, { errorTable: table }, /NOT_FOUND/]),
]) {
  test(`private page denies ${name}`, async () => { await assert.rejects(renderPage(options), error); });
}

test('active partner with investment grant receives terms', async () => {
  assert.ok((await renderPage({ role: 'partner' })).includes('A defined lending opportunity.'));
});

for (const [name, env] of [
  ['production', { VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: production }],
  ['preview connected to Production', { VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: production }],
  ['preview without database URL', { VERCEL_ENV: 'preview' }],
  ['development', { VERCEL_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: staging }],
]) {
  test(`admin preview rejects ${name} before authentication/database access`, async () => {
    const db = fixture({ role: 'admin' });
    await assert.rejects(load(previewPath, db, env).default(), /NOT_FOUND/);
    assert.equal(db.connections(), 0);
  });
}
for (const [name, options] of [
  ['anonymous', { anonymous: true }], ['client', {}], ['partner', { role: 'partner' }],
  ['inactive admin', { role: 'admin', inactive: true }],
  ['profile error', { role: 'admin', errorTable: 'profiles' }],
]) {
  test(`isolated admin preview rejects ${name}`, async () => {
    await assert.rejects(renderPage(options, { VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: staging }, previewPath), /NOT_FOUND/);
  });
}
test('isolated preview permits active Group admin without client project grants', async () => {
  const html = await renderPage({ role: 'admin', noProjectGrant: true, types: [] }, { VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: staging }, previewPath);
  assert.ok(html.includes('A defined lending opportunity.'));
  assert.ok(html.includes('ENQUIRE ABOUT ACQUISITION'));
});
