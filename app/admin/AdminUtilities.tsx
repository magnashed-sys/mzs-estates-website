'use client';

import {usePathname} from 'next/navigation';
import AdminDirectory from './AdminDirectory';
import AdminLanguageSwitcher from './AdminLanguageSwitcher';

/** Workspace pages include these controls in their compact header. */
export default function AdminUtilities() {
  const pathname = usePathname();
  if (pathname === '/admin/workspaces' || pathname.startsWith('/admin/workspaces/')) return null;
  return <><AdminLanguageSwitcher/><AdminDirectory/></>;
}
