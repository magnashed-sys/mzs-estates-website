import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "../../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { deliverOnce } from "../../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const maxDuration = 30;

const STAGING_URL = "https://senonkpxdtlhyhrubicg.supabase.co";
const reply = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

/** Retries one already-authorised, pending activation message in MZS Staging.
 * Does not modify any account, project permission or approval.
 */
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_URL) {
    return reply(404, { error: "Available in MZS Staging only." });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply(403, { error: "Request origin could not be verified." });
  }
  try {
    const supabase = await createServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return reply(401, { error: "Administrator login required." });
    }
    const { data: operator, error: operatorError } = await supabase
      .from("profiles").select("role,is_active").eq("id", auth.user.id).single();
    if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
      return reply(403, { error: "Only active administrators can retry activation emails." });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) return reply(503, { error: "Mail service unavailable." });

    const admin = createSupabaseClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: messages, error: queryError } = await admin
      .from("mzs_mail_outbox")
      .select("id")
      .eq("event_type", "account_activated")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(2);
    if (queryError) throw new Error("Mail queue unavailable.");
    if (!messages?.length) {
      return reply(200, {
        status: "none",
        note: "There are no pending activation emails eligible for retry.",
      });
    }
    if (messages.length !== 1) {
      return reply(409, {
        error: "Multiple activation emails await delivery. Review the queue before retrying.",
      });
    }

    const outcome = await deliverOnce(messages[0].id);
    if (outcome.status === "sent") {
      return reply(200, {
        status: "sent",
        note: "The activation email was accepted by the mail server. Please confirm its arrival in the client's test inbox.",
      });
    }
    return reply(202, {
      status: outcome.status,
      note: "The email has not been confirmed as sent. It remains available for review or a later retry.",
    });
  } catch (error) {
    console.error("[MZS Staging] Activation-email retry failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return reply(503, {
      error: "Unable to complete the retry. Check the staging email queue before trying again.",
    });
  }
}
