import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifiedSessionId(accessToken: string, userId: string): string | null {
  try {
    // verifyOtp() has already verified this access token.
    const encoded = accessToken.split(".")[1];
    if (!encoded) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      sub?: unknown;
      session_id?: unknown;
    };
    return payload.sub === userId &&
      typeof payload.session_id === "string" &&
      UUID.test(payload.session_id)
      ? payload.session_id
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  function makeRedirect(path: string) {
    const result = NextResponse.redirect(new URL(path, origin));
    result.headers.set("Cache-Control", "no-store");
    result.headers.set("Referrer-Policy", "no-referrer");
    return result;
  }

  if (!tokenHash || (type !== "invite" && type !== "recovery")) {
    return makeRedirect("/login?error=invalid-link");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Do not consume a one-time token when the server cannot finish verification.
  if (!supabaseUrl || !publishableKey || !serviceKey) {
    return makeRedirect("/login?error=service-unavailable");
  }

  // Collect ALL Supabase cookie writes, including updates or deletions, before
  // constructing the final redirect. This prevents response replacement from
  // accidentally dropping the authenticated recovery session.
  const cookieWrites: Array<{ name: string; value: string; options?: import("@supabase/ssr").CookieOptions }> = [];

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          request.cookies.set(cookie.name, cookie.value);
          cookieWrites.push(cookie);
        }
      },
    },
  });

  function finish(path: string) {
    const result = makeRedirect(path);
    for (const cookie of cookieWrites) {
      result.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return result;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error || !data.user || !data.session?.access_token) {
    return finish("/login?error=link-expired");
  }

  const sessionId = verifiedSessionId(data.session.access_token, data.user.id);
  if (!sessionId) {
    await supabase.auth.signOut().catch(() => undefined);
    return finish("/login?error=verification-failed");
  }

  // This service-role client is server-only. Never expose the key to the browser.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: recorded, error: recordError } = await admin.rpc(
    "record_mzs_verified_auth_action",
    {
      p_user_id: data.user.id,
      p_session_id: sessionId,
      p_purpose: type,
    }
  );

  if (recordError || recorded !== true) {
    await supabase.auth.signOut().catch(() => undefined);
    return finish("/login?error=verification-failed");
  }

  return finish(type === "invite" ? "/accept-invitation" : "/reset-password");
}
