"use client";
import {useEffect, useRef} from 'react';
import {useTranslations} from 'next-intl';
import {usePathname} from 'next/navigation';
import {locales, publicRoute, localizedPath} from '../../i18n/public-routing';
import styles from './PublicHeader.module.css';

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const route = publicRoute(pathname);
  const t = useTranslations('Language');
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: Event) {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target)) {
        disclosure.current?.removeAttribute('open');
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    // Close on a known outside focus target, not blur: pointer interactions
    // can blur the summary before a language link receives its click.
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, []);
  if (!route) return null;
  return <details className={styles.languages} ref={disclosure}
    onKeyDown={event => {
      if (event.key === 'Escape' && disclosure.current?.open) {
        disclosure.current.open = false;
        disclosure.current.querySelector('summary')?.focus();
      }
    }}>
    <summary className={styles.languageToggle} aria-label={t('choose')} title={t('choose')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M5 6.5h14M5 17.5h14" />
      </svg>
    </summary>
    <nav className={styles.languagePanel} aria-label={t('choose')}>
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
      }}><span>{{en: 'English', nl: 'Nederlands', es: 'Español'}[locale]}</span>
        {route.locale === locale && <span aria-hidden="true">✓</span>}</a>)}
    </nav>
  </details>;
}
