import type { Metadata } from "next";
import {getLocale} from 'next-intl/server';
import AdminHeader from './AdminHeader';
import './admin-light-content.css';
import {AdminNavigationProvider} from './AdminNavigationGuard';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({children}: {children: React.ReactNode}) {
  const locale=await getLocale();
  return <div lang={locale==='es'?'es':'en'} dir="ltr"><AdminNavigationProvider><AdminHeader/><div className="admin-light-content">{children}</div></AdminNavigationProvider></div>;
}
