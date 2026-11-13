"use client";
import {NextIntlClientProvider, useMessages, useLocale, type AbstractIntlMessages} from 'next-intl';

/** Nested providers replace messages, so explicitly retain shared navigation/form copy. */
export default function ScopedClientMessages({messages, children}: {messages: AbstractIntlMessages; children: React.ReactNode}) {
  const shared = useMessages();
  const locale = useLocale();
  return <NextIntlClientProvider locale={locale} messages={{...shared, ...messages}}>{children}</NextIntlClientProvider>;
}
