"use client";
import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {usePathname} from 'next/navigation';
import {locales, memberLocales, publicRoute, localizedPath, isAccountPath} from '../../i18n/public-routing';
import {createClient} from '../../lib/supabase/client';
import {rememberLocale} from '../../i18n/client-preference';
import styles from './PublicHeader.module.css';

export default function LanguageSwitcher({account = false, inline = false, languageLinks}: {account?: boolean; inline?: boolean; languageLinks?: Record<string,string>}) {
  const currentLocale = useLocale();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const pathname = usePathname();
  const route = account || isAccountPath(pathname) ? {locale: currentLocale, path: pathname} : publicRoute(pathname);
  const t = useTranslations('Language');
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (inline) return;
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
  }, [inline]);
  if (!route) return null;
  const target = (locale: string) => languageLinks?.[locale] || localizedPath(route.path.startsWith('/insights/') ? '/insights' : route.path, locale);
  const visibleLocales = (account ? memberLocales : locales).filter(locale => !languageLinks || locale in languageLinks);
  const languagePanel = (<nav className={inline ? styles.languageInline : styles.languagePanel} aria-label={t('choose')}
    style={inline ? {"--language-columns": Math.max(1, Math.ceil(visibleLocales.length / 2))} as CSSProperties : undefined}>
    {visibleLocales.map(locale => <a key={locale} href={target(locale)}
      hrefLang={locale} lang={locale} dir="ltr" aria-label={{en: 'English', nl: 'Nederlands', es: 'Español', ru: 'Русский', de: 'Deutsch', it: 'Italiano', fr: 'Français', 'pt-BR': 'Português (Brasil)', ar: 'العربية', tr: 'Türkçe', lt: 'Lietuvių', pl: 'Polski', 'zh-CN': '简体中文', sv: 'Svenska', ro: 'Română', nb: 'Norsk bokmål', da: 'Dansk', uk: 'Українська', fi: 'Suomi', cs: 'Čeština', hu: 'Magyar', bg: 'Български', sk: 'Slovenčina', el: 'Ελληνικά'}[locale]}
      title={{en: 'English', nl: 'Nederlands', es: 'Español', ru: 'Русский', de: 'Deutsch', it: 'Italiano', fr: 'Français', 'pt-BR': 'Português (Brasil)', ar: 'العربية', tr: 'Türkçe', lt: 'Lietuvių', pl: 'Polski', 'zh-CN': '简体中文', sv: 'Svenska', ro: 'Română', nb: 'Norsk bokmål', da: 'Dansk', uk: 'Українська', fi: 'Suomi', cs: 'Čeština', hu: 'Magyar', bg: 'Български', sk: 'Slovenčina', el: 'Ελληνικά'}[locale]}
      aria-current={route.locale === locale ? 'page' : undefined}
      aria-disabled={busy || undefined}
      onClick={async event => {
        if (account) {
          event.preventDefault();
          if (busy) return;
          setBusy(true); setSaveError(false);
          try {
            const {error} = await createClient().auth.updateUser({data: {preferred_language: locale}});
            if (error) throw error;
            rememberLocale(locale);
            location.reload();
          } catch {setSaveError(true); setBusy(false);}
          return;
        }
        // Use a document navigation so the root HTML language changes immediately.
        document.cookie = `MZS_LOCALE=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          // A same-URL navigation with a fragment can skip the document reload.
          // Neutral account routes need a reload to apply the new server-side locale.
          if (isAccountPath(pathname)) location.reload();
          else location.assign(target(locale) + location.search + location.hash);
        }
      }}><span className={styles.languageFlag} aria-hidden="true">{{en: '🇬🇧', nl: '🇳🇱', es: '🇪🇸', ru: '🇷🇺', de: '🇩🇪', it: '🇮🇹', fr: '🇫🇷', 'pt-BR': '🇧🇷', ar: '🇦🇪', tr: '🇹🇷', lt: '🇱🇹', pl: '🇵🇱', 'zh-CN': '🇨🇳', sv: '🇸🇪', ro: '🇷🇴', nb: '🇳🇴', da: '🇩🇰', uk: '🇺🇦', fi: '🇫🇮', cs: '🇨🇿', hu: '🇭🇺', bg: '🇧🇬', sk: '🇸🇰', el: '🇬🇷'}[locale]}</span>
        {route.locale === locale && <span aria-hidden="true">✓</span>}</a>)}
      {busy && <p role="status" className={styles.languageStatus}>{t("saving")}</p>}
      {saveError && <p role="alert" className={styles.languageStatus}>{t("save_failed")}</p>}
    </nav>);
  if (inline) return languagePanel;
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
    {languagePanel}
  </details>;
}
