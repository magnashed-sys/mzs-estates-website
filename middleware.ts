import { NextResponse, type NextRequest } from "next/server";
import {publicRoute, isLocale, localizedPath, isAccountPath, publicPaths} from "./i18n/public-routing";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // A saved explicit choice applies only at the language-neutral entry point.
  // Language-specific URLs always win; login shares the public choice.
  // Recovery, API and private paths are never redirected for language.
  const preference = request.cookies.get("MZS_LOCALE")?.value;
  if ((pathname === "/" || pathname === "/login") && isLocale(preference) && preference !== "en") {
    const destination = request.nextUrl.clone();
    destination.pathname = localizedPath(pathname, preference);
    const redirect = NextResponse.redirect(destination, 307);
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Vary", "Cookie");
    return redirect;
  }

  // Never trust a caller-supplied locale header on private or machine routes.
  const forwardedHeaders = new Headers(request.headers);
  const publicPage = publicRoute(pathname);
  forwardedHeaders.set("x-mzs-locale", publicPage?.locale || (isAccountPath(pathname) && isLocale(preference) ? preference : "en"));
  forwardedHeaders.set("x-mzs-client-overview", (pathname === "/private" || pathname.startsWith("/private/")) ? "true" : "false");
  const next = () => {
    const response = NextResponse.next({request: {headers: forwardedHeaders}});
    // A direct localized landing must carry its language to neutral account
    // routes too, even when the visitor has never used the language menu.
    if (publicPage && preference !== publicPage.locale) {
      response.cookies.set("MZS_LOCALE", publicPage.locale, {
        path: "/", maxAge: 31536000, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
      });
    }
    return response;
  };

  // Recovery and invitation confirmation handle their own one-time OTP and
  // cookie/session state. Do not refresh an existing session on these routes.
  if (
    pathname === "/auth/confirm" ||
    pathname === "/reset-password" ||
    pathname === "/forgot-password" ||
    pathname === "/accept-invitation"
  ) {
    return next();
  }

  let response = next();

  // Only anonymous marketing GET/HEAD requests skip session refresh.
  // Account, private, API and authenticated requests retain the existing flow.
  const marketing = publicPage && (publicPaths as readonly string[]).includes(publicPage.path);
  const hasAuthCookie = request.cookies.getAll().some(({name}) => /^sb-.*-auth-token(?:\.\d+)?$/.test(name));
  if (marketing && (request.method === "GET" || request.method === "HEAD") && !hasAuthCookie) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          forwardedHeaders.set("cookie", request.headers.get("cookie") || "");
          response = next();

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh sessions for normal application pages.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
