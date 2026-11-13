import {NextIntlClientProvider} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import type { Metadata } from "next";
import AnalyticsConsent from "./components/AnalyticsConsent";
import VisitorActivity from "./components/VisitorActivity";
import PublicWebAnalytics from "./components/PublicWebAnalytics";
import PublicSpeedInsights from "./components/PublicSpeedInsights";
import "./globals.css";
import "./rtl.css";
import {localeDirection} from "../i18n/public-routing";

const siteUrl = "https://www.mzsgroup.com";

const siteDescription =
  "MZS Group is an independent international real estate and investment group, connecting selected clients and partners with private opportunities in Europe and the UAE";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "MZS Group | Private Real Estate & Investments",
    template: "%s | MZS Group",
  },

  description: siteDescription,

  applicationName: "MZS Group",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: process.env.VERCEL_ENV === "production",
    follow: process.env.VERCEL_ENV === "production",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "MZS Group",
    title: "MZS Group | Private Real Estate & Investments",
    description: siteDescription,
    images: [
      {
        url: "/mzs-hero.png",
        alt: "MZS Group — Private Real Estate & Investments",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MZS Group | Private Real Estate & Investments",
    description: siteDescription,
    images: ["/mzs-hero.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const all = await getMessages();
  const privateCopy = all.Private as Record<string, string>;
  const messages = {ContactInput: all.ContactInput, Header: all.Header, Footer: all.Footer, Call: all.Call, Language: all.Language, Private: {signout: privateCopy.signout, signing_out: privateCopy.signing_out, signout_error: privateCopy.signout_error}};
  return (
    <html lang={locale} dir={localeDirection(locale)}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>{children}<AnalyticsConsent preview={process.env.VERCEL_ENV === "preview"} /></NextIntlClientProvider>
        <PublicWebAnalytics />
        <PublicSpeedInsights enabled={process.env.VERCEL_ENV === "production"} />
        <VisitorActivity />
      </body>
    </html>
  );
}

