import { NextResponse, type NextRequest } from "next/server";
import {publicRoute, isLocale, localizedPath, isAccountPath} from "./i18n/public-routing";
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
  const next = () => NextResponse.next({request: {headers: forwardedHeaders}});

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
