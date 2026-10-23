import {notFound} from 'next/navigation';
/** No translated aliases for authenticated, API or recovery routes. */
export default async function LocalizedPublicLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (locale !== 'nl' && locale !== 'es') notFound();
  return children;
}
