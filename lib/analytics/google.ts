import {analyticsPage, cleanLocation, productionHosts, readConsent, validMeasurementId} from './public';
type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {dataLayer?: unknown[]; gtag?: Gtag};
let consentGranted = false;
let activeId = '';
let configured = false;
let lastPage = '';
const id = 'G-JY9NR8LHLE';
export function googleEnabled() {
  return validMeasurementId(id) && productionHosts.has(window.location.hostname);
}
function disable(value: boolean) {
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = value;
}
function allowed() { return googleEnabled() && consentGranted && !!analyticsPage(window.location.pathname); }
export function stopGoogle() { disable(true); lastPage = ''; }
export function setGoogleConsent(granted: boolean) {
  consentGranted = granted;
  if (!granted) {
    // Disable immediately; do not send a withdrawal ping.
    stopGoogle();
    const host = window.location.hostname;
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', host, '.mzsgroup.com', '.mzsgroup.eu']) document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ''} SameSite=Lax; Secure`;
    }
    return;
  }
  sendPage();
}
export function sendPage() {
  if (!allowed()) { stopGoogle(); return; }
  const location = cleanLocation(window.location.href);
  if (!location || lastPage === location) return;
  disable(false);
  const w = window as AnalyticsWindow;
  if (!configured) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function() { w.dataLayer!.push(arguments); };
    w.gtag('consent', 'default', {analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
    w.gtag('consent', 'update', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
    w.gtag('js', new Date());
    w.gtag('config', id, {send_page_view:false, allow_google_signals:false, allow_ad_personalization_signals:false, page_location:location, page_referrer:'', cookie_expires:15552000});
    const script = document.createElement('script');
    script.id = 'mzs-google-tag'; script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);
    activeId = id; configured = true;
  }
  const route = analyticsPage(window.location.pathname)!;
  w.gtag?.('event', 'page_view', {send_to:activeId, page_location:location, page_referrer:lastPage, page_title:`MZS Group | ${route.path}`, language:document.documentElement.lang});
  lastPage = location;
}
export function trackLead(kind: 'intro_call' | 'account_request') {
  if (!allowed() || !configured || !['intro_call','account_request'].includes(kind)) return;
  const location = cleanLocation(window.location.href);
  if (!location) return;
  try { (window as AnalyticsWindow).gtag?.('event', 'generate_lead', {send_to:activeId, lead_type:kind, page_location:location, page_referrer:'', language:document.documentElement.lang}); } catch { /* Analytics must never interrupt a confirmed request. */ }
}
export function restoreGoogleConsent() { setGoogleConsent(readConsent() === 'granted'); }
