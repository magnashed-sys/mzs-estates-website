import {headers} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';
import {isLocale} from './public-routing';
export default getRequestConfig(async () => {
  // Middleware overwrites this header from an exact public-route allowlist.
  const requested = (await headers()).get('x-mzs-locale');
  const locale = isLocale(requested) ? requested : 'en';
  return {locale, timeZone: 'Europe/Madrid', messages: (await import(`../messages/${locale}.json`)).default};
});
