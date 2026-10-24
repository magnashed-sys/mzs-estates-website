"use client";
import {useLocale} from 'next-intl';

/** Documents and external auth mail have a separate translation rollout. */
export default function RussianAccessNotice() {
  if (useLocale() !== 'ru') return null;
  return <p style={{fontSize: '0.85rem', lineHeight: 1.6, color: '#c8c4bb', marginBottom: '1rem'}}>
    Личный кабинет доступен на русском языке. Документы и договоры сохраняют язык оригинала.
    Письма для подтверждения адреса и восстановления пароля пока могут приходить на английском.
  </p>;
}
