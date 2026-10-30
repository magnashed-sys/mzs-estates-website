/** Explicit allowlist: public marketing pages plus login, never private route aliases. */
export const memberLocales = ['en', 'nl', 'de', 'fr', 'es', 'it', 'da', 'nb', 'sv', 'fi', 'cs', 'sk', 'pl', 'hu', 'lt', 'uk', 'ro', 'bg', 'el', 'ru', 'tr', 'zh-CN', 'ar', 'pt-BR'] as const;
export const locales = memberLocales;
/** Presentation preference only; never used for authorization. */
export function memberLocale(value: unknown): typeof memberLocales[number] {
  return typeof value === 'string' && (memberLocales as readonly string[]).includes(value)
    ? value as typeof memberLocales[number] : 'en';
}
export type Locale = typeof locales[number];
export const publicPaths = ['/', '/real-estate', '/private-capital', '/consultancy', '/about'] as const;
export const localizedPaths = [...publicPaths, '/login'] as const;
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}
export function isInsightPath(path: string) {
  try { return /^\/insights(?:\/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)?$/u.test(decodeURIComponent(path)); } catch { return false; }
}
export function publicRoute(pathname: string): {locale: Locale; path: string} | null {
  const match = pathname.match(/^\/(nl|es|ru|de|it|fr|pt-BR|ar|tr|lt|pl|zh-CN|sv|ro|nb|da|uk|fi|cs|hu|bg|sk|el)(\/.*)?$/);
  const path = match ? match[2] || '/' : pathname;
  if (!localizedPaths.includes(path as typeof localizedPaths[number]) && !isInsightPath(path)) return null;
  return {locale: match ? match[1] as Locale : 'en', path};
}
export function localizedPath(path: string, locale: string) {
  return (localizedPaths.includes(path as typeof localizedPaths[number]) || isInsightPath(path)) && isLocale(locale) && locale !== 'en'
    ? `/${locale}${path === '/' ? '' : path}` : path;
}
export function languageAlternates(path: string) {
  return Object.fromEntries([...locales.map(locale => [locale, localizedPath(path, locale)]), ['x-default', path]]);
}

/** Account token routes keep their exact URLs; only their presentation follows the cookie. */
export const accountPaths = ["/request-access", "/registration-pending", "/forgot-password", "/reset-password", "/accept-invitation"] as const;
export function isAccountPath(path: string) { return (accountPaths as readonly string[]).includes(path); }

export function localeDirection(locale: string): "rtl" | "ltr" { return locale === "ar" ? "rtl" : "ltr"; }
