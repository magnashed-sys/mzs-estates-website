import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deliverForRecipient, deliverOnce } from "../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const maxDuration = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["application_received", "account_activated", "new_project_access"]);
const json = (status: number, data: Record<string, unknown>) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

function secureEquals(a: string, b: string) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function verifyOperator(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !pub || !service) return false;
  const browserAuth = createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await browserAuth.auth.getUser(token);
  if (authError || !auth.user) return false;
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error } = await admin.from("profiles")
    .select("role,is_active").eq("id", auth.user.id).single();
  return !error && profile?.role === "admin" && profile.is_active === true;
}

/** An admin action can deliver its committed event immediately. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json(403, { error: "Origin rejected" });
  if (!(await verifyOperator(request))) return json(403, { error: "Administrator required" });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json(400, { error: "Invalid request" });
    }
    const input = body as Record<string, unknown>;
    if (typeof input.event_id === "string" && UUID.test(input.event_id)) {
      const result = await deliverOnce(input.event_id);
      return json(result.status === "sent" ? 200 : 202, result);
    }
    const userId = input.recipient_user_id;
    const eventType = input.event_type;
    if (typeof userId !== "string" || !UUID.test(userId) ||
      typeof eventType !== "string" || !TYPES.has(eventType)) {
      return json(400, { error: "Valid event or recipient selection required" });
    }
    const results = await deliverForRecipient(
      userId, eventType as "application_received" | "account_activated" | "new_project_access", 3
    );
    return json(200, { results });
  } catch {
    // Permission operation already committed. Do not imply it was reverted.
    return json(202, { status: "queued", info: "Delivery requires scheduled retry" });
  }
}

/** Vercel Cron or another authorised scheduler may retry the durable outbox. */
export async function GET(request: NextRequest) {
  const secret = process.env.MZS_NOTIFICATION_CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  if (!secret || !secureEquals(authorization, "Bearer " + secret)) {
    return json(401, { error: "Unauthorised" });
  }
  const results = [];
  for (let index = 0; index < 4; index += 1) {
    try {
      const result = await deliverOnce();
      results.push(result.status);
      if (result.status === "none" || result.status === "not_configured") break;
    } catch {
      results.push("queue_error");
      break;
    }
  }
  return json(200, { processed: results.filter(s => s === "sent").length, results });
}
