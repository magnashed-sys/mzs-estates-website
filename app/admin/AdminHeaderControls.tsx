'use client';

import Link from 'next/link';
import {useRef, useState} from 'react';
import {useAdminI18n} from '../../lib/admin/i18n';
import {createClient} from '../../lib/supabase/client';
import AdminDirectory from './AdminDirectory';
import AdminLanguageSwitcher from './AdminLanguageSwitcher';
import {useAdminNavigation} from './AdminNavigationGuard';
import WorkspaceNavigation from './workspaces/WorkspaceNavigation';
import s from './AdminHeader.module.css';

export default function AdminHeaderControls({groupAdmin}: {groupAdmin: boolean}) {
  const {t} = useAdminI18n();
  const {canNavigate} = useAdminNavigation();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mayLeave = () => !pending.current && canNavigate();

  async function signOut() {
    if (!mayLeave()) return;
    pending.current = true;
    setSigningOut(true);
    setFailed(false);
    try {
      const {error} = await createClient().auth.signOut();
      if (error) throw error;
      window.location.replace('/');
    } catch {
      pending.current = false;
      setSigningOut(false);
      setFailed(true);
    }
  }

  return <header className={s.shell} onClickCapture={event => {
    if ((event.target as Element).closest('a') && !mayLeave()) {
      event.preventDefault();
      event.stopPropagation();
    }
  }}>
    <div className={s.content}>
      <div className={s.topline}>
        <div className={s.identity}>
          <Link href={groupAdmin ? '/admin/workspaces/group' : '/admin/group/capital'} className={s.brand}>MZS GROUP</Link>
          <span className={s.tag}>{t(groupAdmin ? 'Private Administration' : 'SCOPED CAPITAL ADMINISTRATION')}</span>
        </div>
        <div className={s.links}>
          {groupAdmin && <Link href="/admin/accounts">{t('Account requests')}</Link>}
          <Link href="/" target="_blank" rel="noopener noreferrer">{t('Public website ↗')}</Link>
          <AdminLanguageSwitcher compact beforeChange={mayLeave}/>
        </div>
      </div>
      {groupAdmin && <div className={s.modules}><AdminDirectory/></div>}
      <div className={s.navigation}>
        {groupAdmin ? <WorkspaceNavigation disabled={signingOut}/> : <nav aria-label={t('Administration workspaces')} className={s.capitalNav}>
          <Link href="/admin/group/capital">{t('Capital')}</Link>
          <Link href="/admin/capital-requests">{t('Capital requests')}</Link>
        </nav>}
        <button type="button" className={s.signOut} disabled={signingOut} onClick={() => void signOut()}>{t(signingOut ? 'Signing out…' : 'Sign out')}</button>
      </div>
      {failed && <p className={s.error} role="alert">{t('Unable to sign out. Please try again.')}</p>}
    </div>
  </header>;
}
