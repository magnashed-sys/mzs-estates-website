import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_CHECKS, checkPublicRoute, runPublicHealthChecks} from '../scripts/check-public-health.mjs';

const page = (status = 200, type = 'text/html; charset=utf-8') =>
  new Response('', {status, headers: {'content-type': type}});

test('read-only checks cover the main MZS pages and SEO endpoints exactly once', () => {
  const paths = PUBLIC_CHECKS.map(item => item.path);
  assert.deepEqual(paths, ['/', '/real-estate', '/private-capital', '/consultancy', '/about', '/login', '/robots.txt', '/sitemap.xml']);
  assert.equal(new Set(paths).size, paths.length);
});

test('all health checks only issue anonymous GET requests for the public host', async () => {
  const requested = [];
  const fakeFetch = async (url, options) => {
    requested.push({url: String(url), options});
    const contentType = url.pathname === '/robots.txt' ? 'text/plain' :
      url.pathname === '/sitemap.xml' ? 'application/xml' : 'text/html';
    return page(200, contentType);
  };
  const result = await runPublicHealthChecks(fakeFetch);
  assert.equal(result.failures.length, 0);
  assert.equal(result.results.length, PUBLIC_CHECKS.length);
  assert.ok(requested.every(({url, options}) =>
    url.startsWith('https://www.mzsgroup.com/') &&
    options.method === 'GET' &&
    options.redirect === 'manual' &&
    !('authorization' in options.headers) &&
    !('cookie' in options.headers)));
});

test('safe same-site redirects are followed without leaking credentials', async () => {
  let requests = 0;
  const result = await checkPublicRoute(PUBLIC_CHECKS[0], async () => {
    requests++;
    return requests === 1 ?
      new Response(null, {status: 307, headers: {location: '/en'}}) :
      page();
  });
  assert.equal(result.destination, '/en');
  assert.equal(requests, 2);
});

test('redirects to other sites and unapproved endpoints are rejected', async () => {
  await assert.rejects(
    checkPublicRoute(PUBLIC_CHECKS[0], async () =>
      new Response(null, {status: 302, headers: {location: 'https://external.example/collect'}})),
    /outside the public MZS website/
  );
  await assert.rejects(
    checkPublicRoute({path: '/admin', contentType: 'text/html'}, async () => page()),
    /Unknown public route check/
  );
});

test('HTTP failures and unexpected MIME types produce explicit failures, not false success', async () => {
  const noAccess = await runPublicHealthChecks(async () => page(403));
  assert.equal(noAccess.results.length, 0);
  assert.equal(noAccess.failures.length, PUBLIC_CHECKS.length);
  const wrongType = await runPublicHealthChecks(async () => page(200, 'application/json'));
  assert.equal(wrongType.failures.length, PUBLIC_CHECKS.length);
});
