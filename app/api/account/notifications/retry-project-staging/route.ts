import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "../../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { deliverOnce } from "../../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const maxDuration = 30;
const STAGING = "https://senonkpxdtlhyhrubicg.supabase.co";
const reply = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });

/** Retry already-queued, staging-only project notifications, once per event.
 * Do not modify accounts, project access or old invitation records.
 */
export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING) {
    return reply(404, { error: "This is available only in MZS Staging." });
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply(403, { error: "Request origin could not be verified." });
  }
  try {
    const supabase = await createServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return reply(401, { error: "Administrator sign-in required." });
    }
    const { data: operator, error: operatorError } = await supabase
      .from("profiles").select("role,is_active").eq("id", auth.user.id).single();
    if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
      return reply(403, { error: "Active administrator access required." });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return reply(503, { error: "Mail service unavailable." });
    }
    const admin = createSupabaseClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: pending, error: pendingError } = await admin
      .from("mzs_mail_outbox").select("id")
      .eq("event_type", "new_project_access")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(6);
    if (pendingError) {
      return reply(503, { error: "Unable to inspect the project notification queue." });
    }
    if (!pending?.length) {
      return reply(200, {
        status: "none",
        note: "No pending project notification emails require delivery.",
      });
    }
    if (pending.length > 5) {
      return reply(409, {
        error: "Too many pending emails. Review the test queue before sending.",
      });
    }

    const results = [];
    for (const entry of pending) {
      // The database claim function prevents overlapping requests from
      // claiming the same queued email at the same time.
      const delivery = await deliverOnce(entry.id);
      results.push(delivery.status);
    }
    const sent = results.filter(status => status === "sent").length;
    return reply(sent === results.length ? 200 : 202, {
      status: sent === results.length ? "sent" : "partially_queued",
      emailsAccepted: sent,
      processed: results.length,
      note: sent === results.length
        ? "The mail server accepted the queued project notifications. Confirm their arrival in the test inbox."
        : "Some notifications were not accepted. Review the staging outbox before retrying.",
    });
  } catch (cause) {
    console.error("[MZS Staging] Project-email retry failed", {
      type: cause instanceof Error ? cause.name : "unknown",
    });
    return reply(503, {
      error: "Unable to confirm project-email delivery. Check the staging queue before retrying.",
    });
  }
}
