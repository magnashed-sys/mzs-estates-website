'use client';
import {useEffect, useId, useMemo, useRef, useState, type ReactNode} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {callingCode, countryOptions, editPhone, splitPhone} from '../../lib/contact-inputs';
import s from './contact-inputs.module.css';

export default function PhoneInput({value, onChange, label, name, disabled, className = ''}: {
  value: string; onChange: (value: string) => void; label: ReactNode; name?: string; disabled?: boolean; className?: string;
}) {
  const locale = useLocale(); const t = useTranslations('ContactInput'); const id = useId();
  const options = useMemo(() => countryOptions(locale, true), [locale]);
  const [draft, setDraft] = useState(() => splitPhone(value));
  const input = useRef<HTMLInputElement>(null);
  // A different dossier or form reset replaces the draft; ordinary typing retains the chosen prefix.
  if (value !== draft.value) setDraft(splitPhone(value));
  const error = draft.error ? t(draft.error) : '';
  useEffect(() => { input.current?.setCustomValidity(error); }, [error]);
  function change(number: string, country: string) {
    const next = editPhone(number, country);
    input.current?.setCustomValidity(next.error ? t(next.error) : '');
    setDraft(next); onChange(next.value);
  }
  return <div className={`${s.field} ${className}`} role="group" aria-labelledby={`${id}-label`}>
    <span id={`${id}-label`}>{label}</span>
    <div className={s.phone}>
      <select className={s.country} aria-label={t('callingCode')} autoComplete="tel-country-code" disabled={disabled}
        value={draft.country} onChange={e => change(draft.national, e.target.value)}>
        <option value="">{t('callingCode')}</option>
        {draft.country.startsWith('+') && <option value={draft.country}>{t('international')} ({draft.country})</option>}
        {options.map(o => <option key={o.code} value={o.code}>{o.name} (+{callingCode(o.code)})</option>)}
      </select>
      <input ref={input} type="tel" dir="ltr" aria-label={t('number')} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="tel-national" placeholder={t('number')} value={draft.national} disabled={disabled} maxLength={100}
        onChange={e => change(e.target.value, draft.country)}/>
    </div>
    {name && <input type="hidden" name={name} value={value} disabled={disabled}/>}
    {error && <span id={`${id}-error`} className={s.error}>{error}</span>}
  </div>;
}
