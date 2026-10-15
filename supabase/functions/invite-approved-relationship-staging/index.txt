import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const STAGING_SUPABASE = "https://senonkpxdtlhyhrubicg.supabase.co";
const previewPattern = /^https:\/\/mzs-group-[a-z0-9-]+-mzs3\.vercel\.app$/i;

// Only the MZS private staging Preview can initiate invitation actions.
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const permitted = previewPattern.test(origin);
  const headers = {
    "Access-Control-Allow-Origin": permitted ? origin : "null",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const respond = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: permitted ? 204 : 403, headers });
  if (!permitted) return respond(403, { error: "MZS Staging Preview origin required" });
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });
  const bearer = req.headers.get("authorization") ?? "";
  if (!bearer.startsWith("Bearer ")) return respond(401, { error: "Authentication required" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service || url !== STAGING_SUPABASE) return respond(503, { error: "MZS Staging configuration unavailable" });

  const auth = createClient(url, anon, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return respond(401, { error: "Invalid session" });

  const { data: operator, error: operatorError } = await admin
    .from("profiles").select("role,is_active").eq("id", user.id).single();
  if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
    return respond(403, { error: "Administrator access required" });
  }

  let input: unknown;
  try { input = await req.json(); }
  catch { return respond(400, { error: "Invalid JSON" }); }
  if (!input || typeof input !== "object") return respond(400, { error: "Invalid input" });
  const { request_id, role } = input as Record<string, unknown>;
  if (typeof request_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request_id) ||
      (role !== "client" && role !== "partner")) {
    return respond(400, { error: "Valid request_id and role required" });
  }

  const { data: application, error: applicationError } = await admin
    .from("access_requests")
    .select("id,full_name,email,status")
    .eq("id", request_id).single();
  if (applicationError || !application || application.status !== "approved") {
    return respond(409, { error: "Request must be approved first" });
  }
  if (typeof application.email !== "string" || !application.email.trim()) {
    return respond(409, { error: "Request has no valid email" });
  }
  const email = application.email.trim().toLowerCase();

  const { data: existing, error: existingError } = await admin
    .from("profiles").select("id").ilike("email", email).limit(1);
  if (existingError) return respond(500, { error: "Unable to verify existing accounts" });
  if (existing?.length) return respond(409, { error: "Account already exists; manage it separately" });

  // Unique database constraints on request_id and lower(email) make
  // concurrent requests fail closed before sending an email.
  const { data: reservation, error: reservationError } = await admin
    .from("access_invitations")
    .insert({ request_id, email, requested_role: role, invited_by: user.id, status: "reserved" })
    .select("id").single();
  if (reservationError || !reservation) {
    return respond(409, { error: "Invitation already exists or requires administrator review" });
  }

  // An external email send cannot be rolled back transactionally.
  // Do not auto-retry after this point; preserve the record for review.
  const { data: invitation, error: sendError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: application.full_name },
    redirectTo: origin + "/auth/confirm",
  });
  if (sendError || !invitation.user) {
    await admin.from("access_invitations")
      .update({ status: "needs_review" }).eq("id", reservation.id);
    return respond(502, { error: "Invitation outcome requires administrator review. Do not resend automatically." });
  }

  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update({ role, is_active: false })
    .eq("id", invitation.user.id)
    .select("id,role,is_active")
    .single();

  if (profileError || !updatedProfile ||
      updatedProfile.is_active !== false || updatedProfile.role !== role) {
    await admin.from("access_invitations").update({
      auth_user_id: invitation.user.id, status: "needs_review",
    }).eq("id", reservation.id);
    return respond(500, { error: "Invitation sent; profile requires administrator review before activation" });
  }

  const { error: recordError } = await admin.from("access_invitations").update({
    auth_user_id: invitation.user.id, status: "sent",
  }).eq("id", reservation.id);
  if (recordError) {
    return respond(500, { error: "Invitation sent; status recording needs administrator review" });
  }

  return respond(200, { ok: true, status: "sent" });
});