import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (status: number, data: Record<string, unknown>) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return respond(403, { error: "Request origin could not be verified." });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return respond(401, { error: "Please sign in first." });
  const { data: profile } = await supabase.from("profiles")
    .select("role,is_active,full_name,email").eq("id", auth.user.id).single();
  if (!profile?.is_active || !["client", "partner"].includes(profile.role)) {
    return respond(403, { error: "An active private account is required." });
  }
  let body: { type?: unknown; amount?: unknown; explanation?: unknown };
  try { body = await request.json(); } catch { return respond(400, { error: "Invalid request." }); }
  const type = body.type;
  const amount = body.amount;
  const explanation = typeof body.explanation === "string" ? body.explanation.trim() : "";
  if ((type !== "capital" && type !== "possibilities") ||
      typeof amount !== "number" || !Number.isFinite(amount) ||
      amount <= 0 || amount > 100000000000 ||
      Math.round(amount * 100) !== amount * 100 ||
      explanation.length < 10 || explanation.length > 4000) {
    return respond(400, { error: "Please enter a valid amount and a description of 10–4000 characters." });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return respond(503, { error: "Submission is temporarily unavailable." });
  const admin = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: saved, error: insertError } = await admin.from("mzs_capital_requests")
    .insert({ user_id: auth.user.id, request_type: type, amount_eur: amount, explanation })
    .select("id").single();
  if (insertError || !saved) {
    console.error("[Capital requests] Insert failed", insertError?.code);
    return respond(503, { error: "Your request could not be recorded. Please try again." });
  }

  // Persist first. A temporary SMTP failure never loses a submitted request.
  let accepted = false;
  try {
    const host = process.env.MZS_SMTP_HOST || process.env.SMTP_HOST;
    const port = Number(process.env.MZS_SMTP_PORT || process.env.SMTP_PORT || "587");
    const user = process.env.MZS_SMTP_USER || process.env.SMTP_USER;
    const pass = process.env.MZS_SMTP_PASSWORD || process.env.SMTP_PASSWORD;
    const from = process.env.MZS_SMTP_FROM || process.env.SMTP_FROM || user;
    const { data: admins, error: adminsError } = await admin.from("profiles")
      .select("email").eq("role", "admin").eq("is_active", true);
    if (adminsError) throw adminsError;
    const recipients = [...new Set((admins || []).map(x => x.email).filter((email): email is string =>
      typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)))];
    if (!host || !user || !pass || !from || ![465,587].includes(port) || recipients.length === 0) {
      throw new Error("Mail settings or admin recipients unavailable");
    }
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, requireTLS: port === 587,
      auth: { user, pass }, tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 8000, greetingTimeout: 6000, socketTimeout: 10000,
    });
    try {
      const result = await transport.sendMail({
        from, to: recipients.join(", "),
        subject: "MZS Capital — New " + (type === "capital" ? "Request Capital" : "Request Possibilities"),
        text: ["New private capital request", "Reference: " + saved.id,
          "Type: " + (type === "capital" ? "Request Capital" : "Request Possibilities"),
          "Member: " + (profile.full_name || "Member"), "Email: " + (profile.email || auth.user.email || ""),
          "Amount: EUR " + amount.toLocaleString("en-US"),
          "Explanation:", explanation, "",
          "Review in MZS Group administration."].join("\n"),
      });
      accepted = result.accepted?.length > 0;
    } finally { transport.close(); }
  } catch (error) {
    console.error("[Capital requests] Notification failed", error instanceof Error ? error.name : "unknown");
  }
  await admin.from("mzs_capital_requests")
    .update({ email_status: accepted ? "accepted" : "failed" }).eq("id", saved.id);
  return respond(201, { id: saved.id, recorded: true, notification: accepted ? "accepted" : "pending" });
}
