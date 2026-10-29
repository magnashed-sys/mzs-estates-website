import {getLocale} from 'next-intl/server';
import {adminI18n} from './translation';
export async function getAdminI18n(){return adminI18n(await getLocale());}
