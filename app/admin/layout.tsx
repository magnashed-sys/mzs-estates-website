import type { Metadata } from "next";
import {getLocale} from 'next-intl/server';
import AdminLanguageSwitcher from './AdminLanguageSwitcher';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({children}: {children: React.ReactNode}) {
  const locale=await getLocale();
  return <div lang={locale==='es'?'es':'en'} dir="ltr"><AdminLanguageSwitcher/>{children}</div>;
}
