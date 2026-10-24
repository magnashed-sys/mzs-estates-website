import {notFound} from 'next/navigation';
import {isLocale} from '../../i18n/public-routing';
/** No translated aliases for authenticated, API or recovery routes. */
export default async function LocalizedPublicLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!isLocale(locale) || locale === 'en') notFound();
  return children;
}
