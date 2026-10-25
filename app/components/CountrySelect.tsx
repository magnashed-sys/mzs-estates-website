'use client';
import {useLocale, useTranslations} from 'next-intl';
import {useMemo} from 'react';
import {countryCode, countryName, countryOptions} from '../../lib/contact-inputs';
import s from './contact-inputs.module.css';

export default function CountrySelect({value, onChange, disabled, required, id, className = ''}: {
  value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; id?: string; className?: string;
}) {
  const locale = useLocale(); const t = useTranslations('ContactInput');
  const options = useMemo(() => countryOptions(locale), [locale]);
  const code = countryCode(value);
  return <select id={id} className={`${s.country} ${className}`} autoComplete="country" disabled={disabled} required={required}
    value={value ? code || 'legacy' : ''} onChange={e => onChange(e.target.value === 'legacy' ? value : e.target.value ? countryName(e.target.value) : '')}>
    <option value="">{t('chooseCountry')}</option>
    {value && !code && <option value="legacy">{value}</option>}
    {options.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
  </select>;
}
