import {publicRoute, publicPaths} from '../../i18n/public-routing';
export const consentKey = 'mzs-analytics-consent-v1';
export const productionHosts = new Set(['www.mzsgroup.com', 'mzsgroup.com', 'www.mzsgroup.eu', 'mzsgroup.eu']);
export function analyticsPage(path: string) {
  const normalized = path === '/' ? path : path.replace(/\/$/, '');
  if (normalized === '/request-access') return {locale: 'en', path: normalized};
  const route = publicRoute(normalized);
  return route && (publicPaths as readonly string[]).includes(route.path) ? route : null;
}
export function cleanLocation(href: string) {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || !productionHosts.has(url.hostname) || !analyticsPage(url.pathname)) return null;
    return url.origin + url.pathname.replace(/\/$/, '') + (url.pathname === '/' ? '/' : '');
  } catch { return null; }
}
export function validMeasurementId(id: string) { return /^G-[A-Z0-9]{6,20}$/.test(id); }
export function readConsent() {
  try {
    const value = JSON.parse(localStorage.getItem(consentKey) || 'null');
    return value && Date.now() - value.at < 180 * 86400000 && value.at <= Date.now() && ['granted', 'denied'].includes(value.choice) ? value.choice as 'granted' | 'denied' : null;
  } catch { return null; }
}
export function saveConsent(choice: 'granted' | 'denied') {
  try { localStorage.setItem(consentKey, JSON.stringify({choice, at: Date.now()})); } catch { /* Remains a session choice. */ }
}
