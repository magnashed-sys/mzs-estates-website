'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

export default function ErrorBoundary({reset}:{reset:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <section role="alert"><h1>{adminT("Invoice register unavailable")}</h1><p>{adminT("The complete invoice data could not be verified. No partial balances or totals are shown.")}</p><button onClick={reset}>{adminT("Try again")}</button></section>;}
