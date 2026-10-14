import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SITE = "https://www.mzsgroup.eu";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERESTS = new Set(["investment", "financing", "sale", "rental"]);

const response = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return response(403, { error: "Unable to process this registration." });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishable || !serviceKey) {
    return response(503, { error: "Registration is temporarily unavailable." });
  }

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 9000) return response(413, { error: "Submission is too large." });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("Invalid body");
    input = parsed as Record<string, unknown>;
  } catch {
    return response(400, { error: "Please complete the registration form." });
  }

  // Honeypot: no captcha provider is configured. Keep the honeypot invisible.
  if (input.website) return response(200, { ok: true });

  const fullName = clean(input.full_name, 120);
  const email = clean(input.email, 254).toLowerCase();
  const company = clean(input.company, 120);
  const country = clean(input.country, 100);
  const message = clean(input.message, 2000);
  const password = typeof input.password === "string" ? input.password : "";
  const confirmation = typeof input.confirm_password === "string" ? input.confirm_password : "";
  const selected = Array.isArray(input.interests) ? input.interests : [];
  const interests = [...new Set(selected.filter((item): item is string =>
    typeof item === "string" && INTERESTS.has(item)))];

  if (fullName.length < 3 || fullName.split(" ").length < 2 ||
    !EMAIL.test(email) || selected.length !== interests.length || interests.length > 4 ||
    password.length < 8 || password.length > 128 || password !== confirmation) {
    return response(400, { error: "Check your name, email, interests and password (minimum 8 characters)." });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Hash identifiers with a server-only key. Never store IPs or emails in the rate-limit table.
  const key = (value: string) => createHmac("sha256", serviceKey)
    .update("mzs-registration-v2:" + value).digest("hex");
  const networkId = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limits = [
    { bucket: key("ip:" + networkId), amount: 12, seconds: 86400 },
    { bucket: key("email:" + email), amount: 4, seconds: 3600 },
  ];

  try {
    for (const limit of limits) {
      const { data, error } = await admin.rpc("mzs_check_registration_rate", {
        p_bucket: limit.bucket, p_limit: limit.amount, p_window_seconds: limit.seconds,
      });
      if (error) throw error;
      if (data !== true) return response(429, {
        error: "Too many registration attempts. Please try again later or contact MZS Group.",
      });
    }

    // Explicit duplicate notice, as requested. Never return details about the account.
    const { data: existing, error: searchError } = await admin.from("profiles")
      .select("id").eq("email_normalized", email).limit(1);
    if (searchError) throw searchError;
    if (existing?.length) {
      return response(409, {
        error: "An account already exists for this email address. Please sign in or reset your password.",
      });
    }

    // Supabase sends the confirmation email; the auth.users trigger creates
    // the inactive profile and pending application in the same transaction.
    const signup = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error: signupError } = await signup.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: SITE + "/registration-pending",
        data: {
          mzs_access_request: "v2",
          full_name: fullName,
          company, country, message, interests,
        },
      },
    });

    if (signupError) {
      if (signupError.code === "user_already_exists") {
        return response(409, { error: "An account already exists for this email address. Please sign in." });
      }
      console.error("[MZS registration] Signup rejected", { code: signupError.code || "unknown" });
      return response(503, { error: "Registration could not be completed. Please try again later." });
    }
    if (!data.user) throw Error("Signup did not return a user");

    const { data: application, error: applicationError } = await admin.from("access_requests")
      .select("id").eq("auth_user_id", data.user.id).maybeSingle();
    if (applicationError || !application) {
      console.error("[MZS registration] Missing application record after signup");
      return response(503, {
        error: "Your account may have been created, but we could not verify the application record. Contact MZS Group; do not register twice.",
      });
    }
    if (data.session) {
      // Email confirmation must be enforced in Supabase Auth. The database
      // still blocks account access, but production should be configured to
      // prevent auto-confirmed signup.
      await signup.auth.signOut().catch(() => undefined);
      console.error("[MZS registration] Email confirmation is not enforced in Auth settings");
      return response(503, {
        error: "Registration needs a configuration review. Contact MZS Group; do not register twice.",
      });
    }
    return response(201, { ok: true });
  } catch (error) {
    console.error("[MZS registration] Request failed", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return response(503, { error: "Registration is temporarily unavailable. Please try again later." });
  }
}
