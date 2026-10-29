'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useAdminI18n} from '../../lib/admin/i18n';
import {saveAdminLanguage} from './language-actions';
import s from './language.module.css';
export default function AdminLanguageSwitcher(){
  const {t,language}=useAdminI18n();
  const router=useRouter();const [pending,startTransition]=useTransition();const [failed,setFailed]=useState(false);
  return <div className={s.bar}>
    <label htmlFor="admin-language">{t('Administration language')}</label>
    <select id="admin-language" value={language} disabled={pending} aria-busy={pending} onChange={event=>{
      const selected=event.target.value;setFailed(false);
      startTransition(async()=>{try{const result=await saveAdminLanguage(selected);if(!result.ok){setFailed(true);return;}router.refresh();}catch{setFailed(true);}});
    }}><option value="en" lang="en">English</option><option value="es" lang="es">Español</option></select>
    {pending&&<span role="status">{t('Saving…')}</span>}
    {failed&&<span role="alert">{t('Language could not be saved. Please try again.')}</span>}
  </div>;
}
