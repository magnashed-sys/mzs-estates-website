import {NextIntlClientProvider} from "next-intl";
import {getMessages} from "next-intl/server";
import {projectClientKeys} from "../../../../i18n/project-client-keys";

// Keep the large project catalogue out of marketing and other account pages.
export default async function ProjectLayout({children}: {children: React.ReactNode}) {
  const messages = await getMessages();
  const project = messages.ProjectUI as Record<string, string | Record<string, string>>;
  const clientCopy = Object.fromEntries(projectClientKeys.map(key => [key, project[key]]));
  return <NextIntlClientProvider messages={{ProjectUI: clientCopy}}>
    {children}
  </NextIntlClientProvider>;
}
