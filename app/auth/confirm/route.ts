
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const tokenHash =
    request.nextUrl.searchParams.get("token_hash");

  const type =
    request.nextUrl.searchParams.get("type");

  // Only invitation and password recovery are supported.
  if (
    !tokenHash ||
    (type !== "invite" && type !== "recovery")
  ) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-link", origin)
    );
  }

  // Redirect to the appropriate MZS page.
  const destination =
    type === "invite"
      ? "/accept-invitation"
      : "/reset-password";

  const response = NextResponse.redirect(
    new URL(destination, origin)
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            }
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=link-expired", origin)
    );
  }

  return response;
}
