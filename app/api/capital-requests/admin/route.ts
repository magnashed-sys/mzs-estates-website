import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (status: number, data: Record<string, unknown>) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function PATCH(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return reply(403, { error: "Invalid origin" });
  }
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return reply(401, { error: "Sign in required" });

  let input: { id?: unknown; status?: unknown };
  try { input = await request.json(); }
  catch { return reply(400, { error: "Invalid request" }); }

  if (typeof input.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id) ||
    !["new", "in_review", "contacted", "closed"].includes(String(input.status))) {
    return reply(400, { error: "Invalid request or status" });
  }

  // Authorisation, atomic status update and audit all occur in the database,
  // with the caller's session. No privileged service-role client is used here.
  const { data, error } = await supabase.rpc("mzs_capital_admin_update_request", {
    p_request_id: input.id,
    p_new_status: input.status as string
  });

  if (error) {
    if (error.code === "42501") return reply(403, { error: "Capital administration access required" });
    if (error.code === "P0002") return reply(404, { error: "Request not found" });
    if (error.code === "22023") return reply(400, { error: "Invalid request or status" });
    console.error("[Capital administration] Update RPC failed", error.code);
    return reply(503, { error: "Unable to update request" });
  }
  return reply(200, { updated: data === true });
}
