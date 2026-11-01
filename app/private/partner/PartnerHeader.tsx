'use client';
import Link from 'next/link';
import {useState} from 'react';
import {createClient} from '../../../lib/supabase/client';
import {rememberLocale} from '../../../i18n/client-preference';
import {copy} from '../../../lib/partner/presentation';
import styles from './partner.module.css';
export default function PartnerHeader({locale}:{locale:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const t=(nl:string,en:string,es:string)=>copy(locale,nl,en,es);
 async function changeLanguage(value:string){if(busy)return;setBusy(true);setError('');try{const {error}=await createClient().auth.updateUser({data:{preferred_language:value}});if(error)throw error;rememberLocale(value);window.location.reload();}catch{setError(t('Opslaan mislukt. Probeer opnieuw.','Could not save. Please retry.','No se pudo guardar. Inténtalo de nuevo.'));setBusy(false);}}
 async function signOut(){if(busy)return;setBusy(true);setError('');try{const {error}=await createClient().auth.signOut({scope:'local'});if(error)throw error;window.location.replace('/'+locale);}catch{setError(t('Uitloggen mislukt. Probeer opnieuw.','Sign out failed. Please retry.','No se pudo cerrar sesión. Inténtalo de nuevo.'));setBusy(false);}}
 return <header className={styles.topbar}><Link href='/private/partner' className={styles.brand} aria-label='MZS Group — Partners'><span>MZS<small>GROUP</small></span><span className={styles.brandLabel}>PARTNERS</span></Link><div className={styles.account}><Link href='/private'>{t('Mijn omgeving','My account','Mi cuenta')}</Link><label className={styles.language}><span className={styles.srOnly}>{t('Taal','Language','Idioma')}</span><select aria-label={t('Taal','Language','Idioma')} value={locale} disabled={busy} onChange={e=>void changeLanguage(e.target.value)}><option value='nl'>NL</option><option value='en'>EN</option><option value='es'>ES</option></select></label><button type='button' disabled={busy} onClick={()=>void signOut()}>{t('Uitloggen','Sign out','Salir')}</button></div>{error&&<p className={styles.error} role='alert'>{error}</p>}</header>;
}
