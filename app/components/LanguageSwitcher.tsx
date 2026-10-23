"use client";
import {useTranslations} from 'next-intl';
import {usePathname} from 'next/navigation';
import {locales, publicRoute, localizedPath} from '../../i18n/public-routing';
import styles from './PublicHeader.module.css';

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const route = publicRoute(pathname);
  const t = useTranslations('Language');
  if (!route) return null;
  return <nav className={styles.languages} aria-label={t('choose')}>
    {locales.map(locale => <a key={locale} href={localizedPath(route.path, locale)}
      hrefLang={locale} lang={locale} aria-label={{en: 'English', nl: 'Nederlands', es: 'Español'}[locale]}
      aria-current={route.locale === locale ? 'page' : undefined}
      onClick={event => {
        // Use a document navigation so the root HTML language changes immediately.
        document.cookie = `MZS_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          location.assign(localizedPath(route.path, locale) + location.hash);
        }
      }}>{locale.toUpperCase()}</a>)}
  </nav>;
}
