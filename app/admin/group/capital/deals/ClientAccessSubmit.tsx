'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

import {useFormStatus} from 'react-dom';
export default function ClientAccessSubmit({children}:{children:React.ReactNode}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const {pending}=useFormStatus();
 return <button disabled={pending}>{pending?adminT("Saving…"):children}</button>;
}
