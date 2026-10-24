"use client";
import {useLocale} from 'next-intl';

/** Public phase boundary, not an access restriction. */
export default function RussianAccessNotice() {
  if (useLocale() !== 'ru') return null;
  return <p style={{fontSize: '0.85rem', lineHeight: 1.6, color: '#c8c4bb', marginBottom: '1rem'}}>
    Русская версия пока доступна для публичных страниц и экранов входа.
    Личный кабинет пока не переведён на русский: по умолчанию он откроется на английском,
    если ранее не выбран другой доступный язык. Письма пока не переведены на русский.
  </p>;
}
