'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

export default function ErrorBoundary({reset}:{reset:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <section role="alert"><h1>{adminT("Invoice archive unavailable")}</h1><p>{adminT("The complete data could not be loaded.")}</p><button onClick={reset}>{adminT("Try again")}</button></section>;}
