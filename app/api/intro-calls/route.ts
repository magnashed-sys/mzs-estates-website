import { createHmac } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deliverOnce } from "../../../lib/mzs/notifications";
import { introCallsEnvironmentAllowed, parseIntroCall } from "../../../lib/mzs/intro-calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const response = (status: number, value: Record<string, unknown>) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...(status === 429 ? { "Retry-After": "3600" } : {}) },
});

export async function POST(request: NextRequest) {
  if (!introCallsEnvironmentAllowed()) return response(503, { error: "Contact requests are temporarily unavailable." });
  if (request.headers.get("origin") !== request.nextUrl.origin) return response(403, { error: "Request origin could not be verified." });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return response(415, { error: "Invalid request format." });
  if (Number(request.headers.get("content-length")) > 8000) return response(413, { error: "Please shorten your message." });
  let body: unknown;
  try {
    // Bound the streamed body too; Content-Length can be missing or inaccurate.
    const reader = request.body?.getReader();
    if (!reader) return response(400, { error: "Please complete the form." });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8000) { await reader.cancel(); return response(413, { error: "Please shorten your message." }); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return response(400, { error: "Please complete the form." }); }
  if (body && typeof body === "object" && "website" in body && body.website) return response(400, { error: "Please review the form and try again." });
  const input = parseIntroCall(body);
  if (!input) return response(400, { error: "Please check your name, email and message." });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return response(503, { error: "Contact requests are temporarily unavailable. Please try again later." });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const hash = (value: string) => createHmac("sha256", key).update("mzs-intro-call-v1:" + value).digest("hex");
    // Vercel overwrites x-vercel-forwarded-for with the connecting client IP.
    const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    for (const [bucket, limit] of [[hash("ip:" + ip), 10], [hash("email:" + input.email), 3]] as const) {
      const { data, error } = await db.rpc("mzs_check_registration_rate", { p_bucket: bucket, p_limit: limit, p_window_seconds: 3600 });
      if (error) throw new Error("rate");
      if (data !== true) return response(429, { error: "Too many requests. Please try again in an hour or contact us by email." });
    }
    const { data, error } = await db.rpc(input.source === "real-estate" ? "mzs_submit_intro_call_with_source" : "mzs_submit_intro_call", {
      ...(input.source === "real-estate" ? { p_source: input.source } : {}),
      p_request_key: input.requestKey, p_name: input.name, p_email: input.email, p_phone: input.phone, p_message: input.message,
    });
    if (error || !data?.id) throw new Error("save");
    // The request and administrative mail events have committed together.
    // Preview never sends mail, even if shared SMTP settings are present.
    if (process.env.VERCEL_ENV === "production") after(async () => {
      const events = Array.isArray(data.events) ? data.events.filter((id: unknown): id is string => typeof id === "string") : [];
      await Promise.allSettled(events.map((id: string) => deliverOnce(id)));
    });
    return response(201, { recorded: true, id: data.id });
  } catch {
    console.error("[MZS introductory call] Request could not be recorded");
    return response(503, { error: "We could not confirm your request. Please try again or contact us by email." });
  }
}
