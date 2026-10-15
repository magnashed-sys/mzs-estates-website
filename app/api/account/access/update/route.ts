import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "../../../../../lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { deliverForRecipient } from "../../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const maxDuration = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGING = "https://senonkpxdtlhyhrubicg.supabase.co";

const reply = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

/**
 * Save project rights and start any new-access email from one authenticated
 * server request. The database RPC is authoritative for both the grants and
 * the mail outbox. SMTP errors must never roll back saved permissions.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply(403, { error: "Request origin could not be verified." });
  }
  if (process.env.VERCEL_ENV === "preview" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING) {
    return reply(503, { error: "Preview is not connected to MZS Staging." });
  }

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 11000) return reply(413, { error: "Request too large." });
    const payload: unknown = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return reply(400, { error: "Invalid request." });
    }
    input = payload as Record<string, unknown>;
  } catch {
    return reply(400, { error: "Invalid request." });
  }
  const userId = input.user_id;
  const projectId = input.project_id;
  const ids = input.offering_ids;
  if (typeof userId !== "string" || !UUID.test(userId) ||
      typeof projectId !== "string" || !UUID.test(projectId) ||
      !Array.isArray(ids) || ids.length > 100 ||
      ids.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(ids).size !== ids.length) {
    return reply(400, { error: "Select a valid relationship, project and offerings." });
  }
  const selected = ids as string[];

  try {
    const supabase = await createServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return reply(401, { error: "Administrator sign-in is required." });
    }
    const { data: operator, error: operatorError } = await supabase
      .from("profiles").select("role,is_active").eq("id", auth.user.id).single();
    if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
      return reply(403, { error: "Active administrator access required." });
    }

    const [offeringsResult, oldGrantsResult, recipientResult] = await Promise.all([
      supabase.from("offerings").select("id", { count: "exact" })
        .eq("project_id", projectId),
      supabase.from("offering_access").select("offering_id", { count: "exact" })
        .eq("user_id", userId),
      supabase.from("profiles").select("id,role,is_active").eq("id", userId).single(),
    ]);
    if (offeringsResult.error || oldGrantsResult.error || recipientResult.error ||
        !recipientResult.data || !["client", "partner"].includes(recipientResult.data.role) ||
        (offeringsResult.count != null &&
          offeringsResult.count > (offeringsResult.data?.length ?? 0)) ||
        (oldGrantsResult.count != null &&
          oldGrantsResult.count > (oldGrantsResult.data?.length ?? 0))) {
      return reply(409, { error: "Unable to verify current permissions. Refresh before changing access." });
    }
    const projectOfferingIds = new Set((offeringsResult.data || []).map(x => x.id));
    if (selected.some(id => !projectOfferingIds.has(id))) {
      return reply(400, { error: "Selected offerings do not belong to this project." });
    }
    const oldProjectIds = new Set(
      (oldGrantsResult.data || []).map(x => x.offering_id)
        .filter(id => projectOfferingIds.has(id))
    );
    const added = selected.filter(id => !oldProjectIds.has(id));

    // The RPC serialises concurrent account edits, validates each active
    // offering and atomically records the grants and a notification event.
    const { data: count, error: writeError } = await supabase.rpc(
      "set_relationship_project_access", {
        p_user_id: userId, p_project_id: projectId, p_offering_ids: selected,
      }
    );
    if (writeError || count !== selected.length) {
      return reply(409, {
        error: "Access update was not confirmed. Refresh permissions before retrying.",
        outcomeUncertain: true,
      });
    }

    // Confirm the committed state rather than relying on RPC success alone.
    const [savedProject, savedGrants] = await Promise.all([
      supabase.from("project_access").select("project_id", { count: "exact" })
        .eq("user_id", userId).eq("project_id", projectId),
      supabase.from("offering_access").select("offering_id", { count: "exact" })
        .eq("user_id", userId),
    ]);
    const actual = (savedGrants.data || []).map(g => g.offering_id)
      .filter(id => projectOfferingIds.has(id));
    const consistent = !savedProject.error && !savedGrants.error &&
      savedProject.count === (selected.length ? 1 : 0) &&
      actual.length === selected.length &&
      actual.every(id => selected.includes(id));
    if (!consistent) {
      return reply(409, {
        error: "Access may have changed but final verification failed. Refresh before retrying.",
        outcomeUncertain: true,
      });
    }

    let emailStatus: "none" | "sent" | "queued" = "none";
    let sentCount = 0;
    if (added.length > 0 && recipientResult.data.is_active) {
      emailStatus = "queued";
      try {
        const outcome = await deliverForRecipient(userId, "new_project_access", 5);
        sentCount = outcome.filter(item => item.status === "sent").length;
        if (sentCount > 0) emailStatus = "sent";
      } catch (cause) {
        console.error("[MZS project access] Notification dispatch deferred", {
          type: cause instanceof Error ? cause.name : "unknown",
        });
      }
    }
    return reply(200, {
      ok: true,
      grantedCount: selected.length,
      newOfferingsCount: added.length,
      emailStatus,
      emailsAccepted: sentCount,
    });
  } catch (cause) {
    console.error("[MZS project access] Server update failed", {
      type: cause instanceof Error ? cause.name : "unknown",
    });
    return reply(503, {
      error: "Unable to confirm the permission change. Refresh and review before retrying.",
      outcomeUncertain: true,
    });
  }
}
