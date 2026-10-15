import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { sendSmtpTestMail } from "../../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const reply = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers });

/**
 * Sends precisely one test email to the currently authenticated administrator.
 * The browser cannot select a recipient. No account or project data is changed.
 * The route relies on existing production Supabase Auth and does not require
 * the new, still-unapplied mail outbox/database migration.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return reply(403, { error: "Request origin could not be verified." });
  }
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return reply(401, { error: "Please sign in as MZS Group administrator." });
    }
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role,is_active,email").eq("id", auth.user.id).single();

    if (profileError || profile?.role !== "admin" ||
        profile.is_active !== true || !profile.email) {
      return reply(403, { error: "An active administrator account is required." });
    }

    const accepted = await sendSmtpTestMail(profile.email);
    if (!accepted) {
      return reply(502, {
        error: "The mail server did not accept the test message. Check the Vercel logs.",
      });
    }
    return reply(200, {
      accepted: true,
      message: "The SMTP server accepted the test email. Check your administrator inbox and spam folder to confirm delivery.",
    });
  } catch (error) {
    console.error("[MZS SMTP test] Send failed", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return reply(502, {
      error: "The test message could not be sent. Review the mail transport settings.",
    });
  }
}
