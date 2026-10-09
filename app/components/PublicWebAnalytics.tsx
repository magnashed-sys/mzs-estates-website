"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

/**
 * MZS Group tracks only the public entry pages.
 * No Admin, Private Collection, property, booking, invitation or
 * password-reset pages are ever intentionally tracked.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/request-access",
  "/forgot-password",
]);

const PRODUCTION_HOSTS = new Set(["www.mzsgroup.eu", "mzsgroup.eu"]);

function normalizePath(path: string): string {
  return path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
}

function onlyPublicPageviews(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const address = new URL(event.url);
    const path = normalizePath(address.pathname);

    // Fail closed: no private paths, preview hosts, or custom events.
    if (event.type !== "pageview" || !PUBLIC_PATHS.has(path) || !PRODUCTION_HOSTS.has(address.hostname)) {
      return null;
    }

    // Remove possible personal data, recovery codes and search parameters.
    return { ...event, url: `${address.origin}${path}` };
  } catch {
    return null;
  }
}

export default function PublicWebAnalytics() {
  const pathname = usePathname();

  // Not even the analytics component/script is rendered on private routes.
  if (!pathname || !PUBLIC_PATHS.has(normalizePath(pathname))) {
    return null;
  }

  // Vercel handles consent/collection mechanics; we only filter destinations.
  return <Analytics beforeSend={onlyPublicPageviews} />;
}
