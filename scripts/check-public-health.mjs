// Read-only public availability checks. No authentication, mutations, uploads or database access.
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const PUBLIC_ORIGIN = 'https://www.mzsgroup.com';
const ALLOWED_HOSTS = new Set(['www.mzsgroup.com', 'mzsgroup.com']);

export const PUBLIC_CHECKS = Object.freeze([
  {path: '/', contentType: 'text/html'},
  {path: '/real-estate', contentType: 'text/html'},
  {path: '/private-capital', contentType: 'text/html'},
  {path: '/consultancy', contentType: 'text/html'},
  {path: '/about', contentType: 'text/html'},
  {path: '/login', contentType: 'text/html'},
  {path: '/robots.txt', contentType: 'text/plain'},
  {path: '/sitemap.xml', contentType: 'xml'},
]);

function safePublicUrl(value) {
  const url = new URL(value, PUBLIC_ORIGIN);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) ||
      url.port || url.username || url.password) {
    throw new Error('The response redirected outside the public MZS website');
  }
  return url;
}

export async function checkPublicRoute(check, fetcher = fetch) {
  if (!PUBLIC_CHECKS.some(item => item.path === check.path && item.contentType === check.contentType)) {
    throw new Error('Unknown public route check');
  }
  let target = safePublicUrl(check.path);
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetcher(target, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'MZS-GitHub-ReadOnly-Healthcheck/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });
    try {
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Missing redirect location for ' + check.path);
        target = safePublicUrl(new URL(location, target));
        continue;
      }
      if (response.status !== 200) throw new Error(check.path + ' returned HTTP ' + response.status);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes(check.contentType)) {
        throw new Error(check.path + ' returned unexpected content-type: ' + (contentType || 'missing'));
      }
      return {path: check.path, status: 200, destination: target.pathname};
    } finally {
      // Do not download or retain page bodies or any personal content.
      try { await response.body?.cancel(); } catch {}
    }
  }
  throw new Error('Too many redirects for ' + check.path);
}

export async function runPublicHealthChecks(fetcher = fetch) {
  const results = [];
  const failures = [];
  for (const check of PUBLIC_CHECKS) {
    try {
      const result = await checkPublicRoute(check, fetcher);
      results.push(result);
    } catch (error) {
      failures.push({path: check.path, error: error instanceof Error ? error.message : 'Unknown failure'});
    }
  }
  return {results, failures};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const {results, failures} = await runPublicHealthChecks();
  for (const result of results) console.log('PASS ' + result.path + ' GET 200 (' + result.destination + ')');
  for (const failure of failures) console.error('FAIL ' + failure.path + ': ' + failure.error);
  console.log('Public GET checks: ' + results.length + ' passed, ' + failures.length + ' failed.');
  if (failures.length) process.exitCode = 1;
}
