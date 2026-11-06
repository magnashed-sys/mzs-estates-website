import type { Metadata } from "next";
import {getLocale} from 'next-intl/server';
import AdminUtilities from './AdminUtilities';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({children}: {children: React.ReactNode}) {
  const locale=await getLocale();
  return <div lang={locale==='es'?'es':'en'} dir="ltr"><AdminUtilities/>{children}</div>;
}
