
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl = "https://www.mzsgroup.eu";

const siteDescription =
  "MZS Group is an independent international real estate and investment group, connecting selected clients and partners with private opportunities in Amsterdam, Ibiza, Dubai and beyond.";

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
    index: true,
    follow: true,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
