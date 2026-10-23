/** Explicit allowlist: public marketing pages plus login, never private route aliases. */
export const locales = ['en', 'nl', 'es'] as const;
export type Locale = typeof locales[number];
export const publicPaths = ['/', '/real-estate', '/private-capital'] as const;
export const localizedPaths = [...publicPaths, '/login'] as const;
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}
export function publicRoute(pathname: string): {locale: Locale; path: string} | null {
  const match = pathname.match(/^\/(nl|es)(\/.*)?$/);
  const path = match ? match[2] || '/' : pathname;
  if (!localizedPaths.includes(path as typeof localizedPaths[number])) return null;
  return {locale: match ? match[1] as Locale : 'en', path};
}
export function localizedPath(path: string, locale: string) {
  return localizedPaths.includes(path as typeof localizedPaths[number]) && (locale === 'nl' || locale === 'es')
    ? `/${locale}${path === '/' ? '' : path}` : path;
}
export function languageAlternates(path: string) {
  return Object.fromEntries([...locales.map(locale => [locale, localizedPath(path, locale)]), ['x-default', path]]);
}

/** Account token routes keep their exact URLs; only their presentation follows the cookie. */
export const accountPaths = ["/request-access", "/registration-pending", "/forgot-password", "/reset-password", "/accept-invitation"] as const;
export function isAccountPath(path: string) { return (accountPaths as readonly string[]).includes(path); }
