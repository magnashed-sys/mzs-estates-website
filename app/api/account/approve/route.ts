import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { deliverOnce } from "../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const maxDuration = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Atomically approve a verified registration and dispatch the email from
 * the same server request. Permissions always come from the database RPC.
 * SMTP failure must not reverse a committed approval.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply(403, { error: "Request origin could not be verified." });
  }
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 9000) return reply(413, { error: "Request too large." });
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return reply(400, { error: "Invalid approval request." });
    }
    input = payload as Record<string, unknown>;
  } catch {
    return reply(400, { error: "Invalid approval request." });
  }

  const requestId = input.request_id;
  const role = input.role;
  const offerings = input.offering_ids;
  if (typeof requestId !== "string" || !UUID.test(requestId) ||
      (role !== "client" && role !== "partner") ||
      !Array.isArray(offerings) || offerings.length === 0 || offerings.length > 100 ||
      offerings.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(offerings).size !== offerings.length) {
    return reply(400, { error: "Select a valid role and active opportunities." });
  }

  // Never approve a registration from Preview unless it is using MZS Staging.
  if (process.env.VERCEL_ENV === "preview" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://senonkpxdtlhyhrubicg.supabase.co") {
    return reply(503, { error: "Preview does not use the isolated staging database." });
  }

  try {
    const db = await createClient();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) {
      return reply(401, { error: "Sign in as administrator." });
    }
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role,is_active").eq("id", auth.user.id).single();
    if (profileError || profile?.role !== "admin" || profile.is_active !== true) {
      return reply(403, { error: "Administrator access required." });
    }

    const { data: approved, error: approvalError } = await db.rpc(
      "approve_mzs_registered_request", {
        p_request_id: requestId,
        p_role: role,
        p_offering_ids: offerings,
      }
    );
    if (approvalError || approved?.ok !== true) {
      console.error("[MZS approval] RPC did not confirm success", {
        code: approvalError?.code ?? "unexpected-result",
      });
      return reply(409, { error: "Approval not confirmed. Reload and review before retrying." });
    }

    let emailStatus: "sent" | "queued" = "queued";
    if (typeof approved.mail_event_id === "string" && UUID.test(approved.mail_event_id)) {
      try {
        const outcome = await deliverOnce(approved.mail_event_id);
        if (outcome.status === "sent") emailStatus = "sent";
      } catch (error) {
        console.error("[MZS approval] Delivery deferred", {
          type: error instanceof Error ? error.name : "unknown",
        });
      }
    }
    return reply(200, {
      ok: true, status: "approved", emailStatus,
      projectCount: approved.project_count ?? 0,
    });
  } catch (error) {
    console.error("[MZS approval] Unexpected failure", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return reply(503, { error: "Unable to complete approval. Refresh before retrying." });
  }
}
