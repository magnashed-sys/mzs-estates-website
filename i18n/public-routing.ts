/** Only these public pages participate in phase-one localization. */
export const locales = ['en', 'nl', 'es'] as const;
export type Locale = typeof locales[number];
export const publicPaths = ['/', '/real-estate', '/private-capital'] as const;
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}
export function publicRoute(pathname: string): {locale: Locale; path: string} | null {
  const match = pathname.match(/^\/(nl|es)(\/.*)?$/);
  const path = match ? match[2] || '/' : pathname;
  if (!publicPaths.includes(path as typeof publicPaths[number])) return null;
  return {locale: match ? match[1] as Locale : 'en', path};
}
export function localizedPath(path: string, locale: string) {
  return publicPaths.includes(path as typeof publicPaths[number]) && (locale === 'nl' || locale === 'es')
    ? `/${locale}${path === '/' ? '' : path}` : path;
}
export function languageAlternates(path: string) {
  return Object.fromEntries([...locales.map(locale => [locale, localizedPath(path, locale)]), ['x-default', path]]);
}
