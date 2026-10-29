'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

export default function HistoryError({reset}:{reset:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <section role="alert"><h2>{adminT("Historical statements unavailable")}</h2><p>{adminT("The source data could not be fully loaded. No partial totals are shown.")}</p><button onClick={reset}>{adminT("Reload")}</button></section>;}
