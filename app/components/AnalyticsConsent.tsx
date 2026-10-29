'use client';
import {useEffect, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';
import {useLocale} from 'next-intl';
import {analyticsPage, readConsent, saveConsent} from '../../lib/analytics/public';
import {googleEnabled, restoreGoogleConsent, sendPage, setGoogleConsent, stopGoogle} from '../../lib/analytics/google';
import {analyticsCopy} from '../../lib/analytics/copy';
import {analyticsCompactCopy} from '../../lib/analytics/compact-copy';
import styles from './AnalyticsConsent.module.css';
export default function AnalyticsConsent({preview = false}: {preview?: boolean}) {
  const pathname = usePathname(); const locale = useLocale();
  const [enabled,setEnabled] = useState(false); const [open,setOpen] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const copy = analyticsCopy[locale] || analyticsCopy.en;
  const compact = analyticsCompactCopy[locale] || analyticsCompactCopy.en;
  const publicPage = !!analyticsPage(pathname || '');
  useEffect(() => {
    const enabled = (googleEnabled() || preview) && publicPage; setEnabled(enabled);
    if (!enabled) { stopGoogle(); return; }
    setOpen(readConsent() === null); restoreGoogleConsent(); sendPage();
    function storage() { setOpen(readConsent() === null); restoreGoogleConsent(); }
    function leave(event: MouseEvent) {
      const a = (event.target as Element)?.closest?.('a');
      if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin === window.location.origin && !analyticsPage(url.pathname) && readConsent() === 'granted') {
        stopGoogle(); event.preventDefault(); window.location.assign(url.href);
      }
    }
    window.addEventListener('storage',storage); document.addEventListener('click',leave,true);
    return () => {stopGoogle(); window.removeEventListener('storage',storage); document.removeEventListener('click',leave,true);};
  },[pathname,publicPage,preview]);
  useEffect(() => {
    const element = dock.current;
    if (!enabled || !publicPage || !element) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--mzs-consent-height', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); root.style.removeProperty('--mzs-consent-height'); };
  }, [enabled, open, publicPage]);
  function choose(choice: 'granted' | 'denied') {
    saveConsent(choice); setGoogleConsent(choice === 'granted'); setOpen(false);
    if (choice === 'denied' && document.getElementById('mzs-google-tag')) window.location.reload();
  }
  if (!enabled || !publicPage) return null;
  return <>
    <div className={styles.reserve} aria-hidden="true" />
    <div ref={dock} className={`${styles.dock} ${open ? styles.panel : ''}`}>
      {open ? <section className={styles.bar} aria-label={copy[0]}>
        <div className={styles.copy}>
          <p>{compact[0]}</p>
          <details className={styles.details}>
            <summary>{compact[3]}</summary>
            <div className={styles.explanation}><p>{copy[1]}</p><p>{copy[5]}</p></div>
          </details>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={()=>choose('granted')}>{compact[1]}</button>
          <button type="button" onClick={()=>choose('denied')}>{compact[2]}</button>
        </div>
      </section> : <div className={styles.settingsRow}>
        <button className={styles.settings} type="button" onClick={()=>setOpen(true)}>{copy[4]}</button>
      </div>}
    </div>
  </>;
}
