import {headers, cookies} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';
import {createClient} from '../lib/supabase/server';
import {isLocale, memberLocale} from './public-routing';
export default getRequestConfig(async () => {
  // Middleware overwrites this header from an exact public-route allowlist.
  const requestHeaders = await headers();
  let requested = requestHeaders.get('x-mzs-locale');
  if (requestHeaders.get('x-mzs-client-overview') === 'true') {
    const cookie = (await cookies()).get('MZS_LOCALE')?.value;
    requested = memberLocale(cookie);
    try {
      const db = await createClient();
      const {data: {user}} = await db.auth.getUser();
      const saved = user?.user_metadata?.preferred_language;
      // User-editable metadata is used ONLY for presentation, never authorization.
      if (isLocale(saved)) requested = memberLocale(saved);
    } catch { /* A preference lookup must never replace the page's access checks. */ }
  }
  const locale = isLocale(requested) ? requested : 'en';
  return {locale, timeZone: 'Europe/Madrid', messages: (await import(`../messages/${locale}.json`)).default};
});
