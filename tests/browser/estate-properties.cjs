// Local-only browser integration: synthetic authentication and records, no real accounts.
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.MZS_PLAYWRIGHT_MODULE || 'playwright');
const next = require('next');
const id = '11111111-1111-4111-8111-111111111111';
const propertyId = '22222222-2222-4222-8222-222222222222';
let role = 'admin', active = true, unitsError = false;
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'local-fixture-signature'].join('.');
const units = [
  { id: 'unit1', address: 'Test Street 1A', unit_type: 'studio', tenant_name: 'Synthetic tenant A', monthly_rent: 500.01, utilities_advance: null, sort_order: 1 },
  { id: 'unit2', address: 'Test Street 1B', unit_type: 'room', tenant_name: 'Synthetic tenant B', monthly_rent: 400.02, utilities_advance: null, sort_order: 2 },
];
const property = { id: propertyId, name: 'Synthetic multi-unit building — The Netherlands', address: 'Test Street 1 / Example Street 40', city: 'Test City', country_code: 'NL', owner_name: 'Synthetic owner', ownership_kind: 'personal', rent_basis: 'Rent excludes advance payments for gas, water and electricity.', source_reference: 'Synthetic source', notes: '', ownership_since_year: 2016, managing_agent_name: 'Kramer & Partners', managing_agent_url: 'https://kramerenpartners.nl/', managing_agent_logo: 'kramer-and-partners', mzs_estate_units: units };
const photos = ['4876', '5279'].map((file, i) => ({ id: 'photo'+i, caption: 'Synthetic exterior '+(i+1), image_base64: process.env.MZS_ESTATE_PHOTO_DIR ? require('node:fs').readFileSync(process.env.MZS_ESTATE_PHOTO_DIR+'/estate-'+file+'.webp').toString('base64') : 'UklGRjIAAABXRUJQVlA4ICYAAACQAQCdASoCAAIAAUAmJYgCdLoAA5gA/vX9H+N8QXtXjyKRYvAAAA==', sort_order: i+1 }));
const mock = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/auth/v1/token') return res.end(JSON.stringify({ access_token: token, refresh_token: 'local-fixture-refresh', expires_in: 3600, token_type: 'bearer', user }));
  if (url.pathname === '/auth/v1/user') return res.end(JSON.stringify(user));
  if (url.pathname === '/rest/v1/profiles') return res.end(JSON.stringify({ id, role, is_active: active }));
  if (url.pathname === '/rest/v1/mzs_estate_properties') return res.end(JSON.stringify(url.searchParams.has('id') ? property : [property]));
  if (url.pathname === '/rest/v1/mzs_estate_units') {
    if (unitsError) { res.statusCode = 503; return res.end('{"message":"Synthetic unavailable"}'); }
    return res.end(JSON.stringify(units));
  }
  if (url.pathname === '/rest/v1/mzs_estate_images') return res.end(JSON.stringify(photos));
  if (url.pathname === '/rest/v1/mzs_estate_audit') return res.end(JSON.stringify([{ id: 1, action: 'INSERT', created_at: '2026-10-23T12:00:00Z', source_reference: 'Synthetic source' }]));
  if (url.pathname === '/rest/v1/rpc/mzs_has_department_scope') return res.end('false');
  res.end('[]');
});

(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:3091';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'local-test-key';
  delete process.env.VERCEL_ENV;
  await new Promise(resolve => mock.listen(3091, '127.0.0.1', resolve));
  const app = next({ dev: false, hostname: '127.0.0.1', port: 3096 });
  await app.prepare();
  const server = http.createServer(app.getRequestHandler());
  await new Promise(resolve => server.listen(3096, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.MZS_CHROMIUM_PATH ? { executablePath: process.env.MZS_CHROMIUM_PATH } : {}) });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-'+Buffer.from(JSON.stringify({ access_token: token, refresh_token: 'local-fixture-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user })).toString('base64url'), domain: '127.0.0.1', path: '/' }]);
  await page.goto('http://127.0.0.1:3096/admin/group/estates');
  await page.getByRole('link', { name: /Ownership & units/ }).click();
  await page.getByRole('heading', { name: 'Ownership & units', exact: true }).waitFor();
  await page.getByRole('link', { name: /Synthetic multi-unit/ }).click();
  await page.waitForURL('**/properties/'+propertyId);
  await page.getByRole('heading', { name: property.name, exact: true, level: 1 }).waitFor();
  await page.locator('table, [role="alert"]').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 2, await page.locator('main').innerText());
  assert.match(await page.locator('main').innerText(), /€900\.03/);
  assert.match(await page.locator('main').innerText(), /€10,800\.36/);
  assert.match(await page.locator('main').innerText(), /Not provided/);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Viewport overflow at '+width);
    await page.screenshot({ path: '/tmp/estate-properties-'+width+'.png', fullPage: true });
  }
  assert.match(await page.locator('main').innerText(), /2016/);
  const agent = page.getByRole('link', { name: 'Visit Kramer & Partners website (opens in a new tab)' });
  assert.equal(await agent.getAttribute('href'), 'https://kramerenpartners.nl/');
  assert.equal(await agent.getAttribute('target'), '_blank');
  assert.match(await agent.getAttribute('rel'), /noopener/);
  await page.getByAltText('Synthetic exterior 2').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0));
  assert.equal(await page.locator('main img').count(), 3);
  unitsError = true;
  await page.reload();
  await page.locator('main [role="alert"]').waitFor();
  assert.equal(await page.locator('table').count(), 0);
  assert.ok(!(await page.locator('main').innerText()).includes('€0.00'));
  unitsError = false;
  for (const [newRole, isActive] of [['client', true], ['admin', false]]) {
    role = newRole; active = isActive;
    await page.goto('http://127.0.0.1:3096/admin/group/estates/properties/'+propertyId);
    assert.ok(!(await page.locator('body').innerText()).includes('Synthetic tenant'));
    assert.ok(!(await page.locator('body').innerText()).includes('Synthetic owner'));
  }
  await context.clearCookies();
  await page.goto('http://127.0.0.1:3096/admin/group/estates/properties/'+propertyId);
  assert.ok(!(await page.locator('body').innerText()).includes('Synthetic tenant'));
  assert.deepEqual(errors, []);
  console.log('PASS: cockpit → register → property; units/totals; 375/1440px; error state; client, inactive and signed-out access denied; no browser errors.');
  await browser.close(); server.close(); mock.close(); await app.close(); process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
