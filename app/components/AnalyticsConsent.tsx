'use client';
import {useEffect, useState} from 'react';
import {usePathname} from 'next/navigation';
import {useLocale} from 'next-intl';
import {analyticsPage, readConsent, saveConsent} from '../../lib/analytics/public';
import {googleEnabled, restoreGoogleConsent, sendPage, setGoogleConsent, stopGoogle} from '../../lib/analytics/google';
import {analyticsCopy} from '../../lib/analytics/copy';
import styles from './AnalyticsConsent.module.css';
export default function AnalyticsConsent() {
  const pathname = usePathname(); const locale = useLocale();
  const [enabled,setEnabled] = useState(false); const [open,setOpen] = useState(false);
  const copy = analyticsCopy[locale] || analyticsCopy.en;
  const publicPage = !!analyticsPage(pathname || '');
  useEffect(() => {
    const enabled = googleEnabled() && publicPage; setEnabled(enabled);
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
  },[pathname,publicPage]);
  function choose(choice: 'granted' | 'denied') {
    saveConsent(choice); setGoogleConsent(choice === 'granted'); setOpen(false);
    if (choice === 'denied' && document.getElementById('mzs-google-tag')) window.location.reload();
  }
  if (!enabled || !publicPage) return null;
  return open ? <section className={styles.panel} aria-labelledby="analytics-title"><h2 id="analytics-title">{copy[0]}</h2><p>{copy[1]}</p><p>{copy[5]}</p><div className={styles.actions}><button type="button" onClick={()=>choose('granted')}>{copy[2]}</button><button type="button" onClick={()=>choose('denied')}>{copy[3]}</button></div></section> : <button className={styles.settings} type="button" onClick={()=>setOpen(true)}>{copy[4]}</button>;
}
