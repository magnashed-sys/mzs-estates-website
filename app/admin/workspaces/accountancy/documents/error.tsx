'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';
export default function ErrorBoundary({reset}:{reset:()=>void}){
 const {t}=useAdminI18n();
 return <section role="alert"><h2>{t('Document archive unavailable')}</h2><p>{t('Please retry.')}</p><button onClick={reset}>{t('Try again')}</button></section>;
}
