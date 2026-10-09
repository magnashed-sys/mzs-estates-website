import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifiedSessionId(accessToken: string, userId: string): string | null {
  try {
    // Supabase has already verified this token via verifyOtp/getUser.
    // Decoding here only extracts the authenticated session identifier.
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      sub?: unknown;
      session_id?: unknown;
    };
    return payload.sub === userId && typeof payload.session_id === "string" && UUID.test(payload.session_id)
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

  const redirect = (path: string) => {
    const res = NextResponse.redirect(new URL(path, origin));
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  if (!tokenHash || (type !== "invite" && type !== "recovery")) {
    return redirect("/login?error=invalid-link");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check BEFORE verifyOtp, so a missing environment variable does not
  // consume the one-time email token.
  if (!supabaseUrl || !publishableKey || !serviceKey) {
    return redirect("/login?error=service-unavailable");
  }

  let response = redirect(type === "invite" ? "/accept-invitation" : "/reset-password");

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error || !data.user || !data.session?.access_token) {
    return redirect("/login?error=link-expired");
  }

  const sessionId = verifiedSessionId(data.session.access_token, data.user.id);
  if (!sessionId) {
    response = redirect("/login?error=verification-failed");
    await supabase.auth.signOut().catch(() => undefined);
    return response;
  }

  // This client exists ONLY on the server. Never expose this key to the browser.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only this route, immediately after successful one-time OTP verification,
  // may create a proof tied to the newly issued Supabase Auth session.
  const { data: recorded, error: recordError } = await admin.rpc(
    "record_mzs_verified_auth_action",
    {
      p_user_id: data.user.id,
      p_session_id: sessionId,
      p_purpose: type,
    }
  );

  if (recordError || recorded !== true) {
    response = redirect("/login?error=verification-failed");
    await supabase.auth.signOut().catch(() => undefined);
    return response;
  }

  return response;
}
