import { NextRequest, NextResponse, after } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const reply = (status: number, value: Record<string, unknown>) =>
  NextResponse.json(value, { status, headers });

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const euro = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n);
const date = (s: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" })
  .format(new Date(s + "T12:00:00Z"));
const validDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s + "T12:00:00Z"));
const validTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

type Payload = {
  mode?: unknown; projectId?: unknown; configurationId?: unknown;
  checkIn?: unknown; checkOut?: unknown; guests?: unknown;
  arrival?: unknown; departure?: unknown; notes?: unknown; poolHeating?: unknown;
};

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || request.headers.get("origin") !== request.nextUrl.origin)
    return reply(403, { error: "Origin verification failed." });

  let body: Payload;
  try { body = await request.json() as Payload; }
  catch { return reply(400, { error: "Invalid request." }); }

  if ((body.mode !== "villa" && body.mode !== "configured") ||
      typeof body.projectId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.projectId) ||
      !validDate(body.checkIn) || !validDate(body.checkOut) ||
      !Number.isInteger(body.guests) || Number(body.guests) < 1 || Number(body.guests) > 50 ||
      (body.arrival !== "" && body.arrival != null && !validTime(body.arrival)) ||
      (body.departure !== "" && body.departure != null && !validTime(body.departure)) ||
      (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 2000)) ||
      (body.mode === "configured" && (typeof body.configurationId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.configurationId)))) {
    return reply(400, { error: "Please review your booking details." });
  }

  const db = await createClient();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) return reply(401, { error: "Please sign in to request a stay." });
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("role,is_active,email,full_name").eq("id", auth.user.id).single();
  if (profileError || !profile?.is_active || !["client", "partner"].includes(profile.role))
    return reply(403, { error: "Active private access is required." });

  const args = {
    p_project_id: body.projectId,
    p_check_in: body.checkIn,
    p_check_out: body.checkOut,
    p_guest_count: body.guests as number,
    p_preferred_check_in: body.arrival || null,
    p_preferred_check_out: body.departure || null,
    p_guest_notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
  };
  const result = body.mode === "villa"
    ? await db.rpc("request_rental_booking", {
      ...args, p_pool_heating_requested: body.poolHeating === true,
    })
    : await db.rpc("request_configured_rental_booking", {
      ...args, p_configuration_id: body.configurationId as string,
    });
  if (result.error || typeof result.data !== "string")
    return reply(400, { error: "The booking request could not be registered. Please check availability." });

  // Booking has been committed. Mail errors must never encourage submitting it twice.
  const bookingId = result.data;
  after(async () => {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !url) throw new Error("service configuration");
    const service = serviceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const [{ data: booking, error: bookingError }, { data: admins, error: adminError }] = await Promise.all([
      service.from("rental_bookings").select("id,project_id,user_id,check_in,check_out,guest_count,quoted_total_eur,pool_heating_requested,guest_notes,status")
        .eq("id", bookingId).eq("user_id", auth.user.id).single(),
      service.from("profiles").select("email").eq("role", "admin").eq("is_active", true),
    ]);
    if (bookingError || !booking || booking.status !== "requested" || adminError)
      throw new Error("notification data unavailable");
    const { data: project, error: projectError } = await service.from("projects")
      .select("title").eq("id", booking.project_id).single();
    if (projectError || !project) throw new Error("property unavailable");

    const host = process.env.MZS_SMTP_HOST || process.env.SMTP_HOST;
    const port = Number(process.env.MZS_SMTP_PORT || process.env.SMTP_PORT || "587");
    const user = process.env.MZS_SMTP_USER || process.env.SMTP_USER;
    const pass = process.env.MZS_SMTP_PASSWORD || process.env.SMTP_PASSWORD;
    const from = process.env.MZS_SMTP_FROM || process.env.SMTP_FROM ||
      (user?.includes("@") ? "MZS Group <" + user + ">" : undefined);
    if (!host || !user || !pass || !from || ![465, 587].includes(port))
      throw new Error("SMTP configuration missing");
    const clientEmail = profile.email || auth.user.email;
    const adminEmails = [...new Set((admins || []).map(x => x.email).filter((e): e is string => typeof e === "string" && e.includes("@")))];
    if (!clientEmail || !adminEmails.length) throw new Error("recipient unavailable");

    const nights = Math.round((Date.parse(booking.check_out + "T12:00:00Z") -
      Date.parse(booking.check_in + "T12:00:00Z")) / 86400000);
    const details = [
      ["Property", project.title],
      ["Check-in", date(booking.check_in)],
      ["Check-out", date(booking.check_out)],
      ["Nights", String(nights)],
      ["Guests", String(booking.guest_count)],
      ["Estimated total", euro(Number(booking.quoted_total_eur))],
      ...(body.mode === "villa" ? [["Pool heating requested", booking.pool_heating_requested ? "Yes" : "No"]] : []),
      ["Special requests", booking.guest_notes || "None"],
    ];
    const lines = details.map(([label, value]) => label + ": " + value).join("\n");
    const table = details.map(([label, value]) =>
      "<tr><td style='padding:10px;color:#d5c09a;vertical-align:top'>" + escapeHtml(label) +
      "</td><td style='padding:10px;color:#eeeae2'>" + escapeHtml(value) + "</td></tr>").join("");
    function html(title: string, intro: string, link: string) {
      return "<!doctype html><html lang='en'><body style='background:#0b0b0a;color:#eeeae2;font-family:Arial,sans-serif'>" +
        "<div style='max-width:580px;margin:24px auto;padding:35px;border:1px solid #514839;background:#151411'>" +
        "<p style='color:#d5c09a;letter-spacing:4px;text-align:center'>MZS GROUP</p>" +
        "<h1 style='font:normal 32px Georgia,serif;text-align:center'>" + escapeHtml(title) + "</h1>" +
        "<p style='line-height:1.8'>" + escapeHtml(intro) + "</p><table style='width:100%;border-collapse:collapse'>" +
        table + "</table><p style='text-align:center;margin:40px 0'><a href='" + link +
        "' style='background:#d5c09a;color:#111;padding:15px 20px;text-decoration:none'>VIEW REQUEST →</a></p>" +
        "<p style='color:#aaa59b;font-size:12px'>PRIVATE · INDEPENDENT · INTERNATIONAL</p></div></body></html>";
    }
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, requireTLS: port === 587,
      auth: { user, pass }, tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 8000, greetingTimeout: 6000, socketTimeout: 10000,
    });
    const clientText = "We have received your booking request. This is not a confirmed reservation. " +
      "MZS Group will contact you after individual review and approval.\n\n" + lines;
    const adminText = "A new private rental request has been registered. It is awaiting approval.\n" +
      "Requester: " + (profile.full_name || "Private client") + "\nEmail: " + clientEmail +
      "\nReference: " + bookingId + "\n\n" + lines;
    const settled = await Promise.allSettled([
      transport.sendMail({
        from, to: clientEmail, subject: "Booking request received | MZS Group",
        text: clientText, html: html("Your booking request.", "We have received your request. This is not a confirmed reservation. You will receive a separate confirmation after approval.", "https://www.mzsgroup.com/private/reservations"),
      }),
      transport.sendMail({
        from, to: adminEmails, subject: "New rental booking request | MZS Group",
        text: adminText, html: html("A new booking request.", "A new request requires your review. Requester: " +
          (profile.full_name || "Private client") + " (" + clientEmail + "). Reference: " + bookingId, "https://www.mzsgroup.com/admin"),
      }),
    ]);
    transport.close();
    if (settled.some(x => x.status === "rejected"))
      console.error("[MZS booking mail] One or more notifications failed", { bookingId });
  } catch (e) {
    console.error("[MZS booking mail] Notifications unavailable", {
      bookingId, category: e instanceof Error ? e.name : "unknown",
    });
  }
  });
  return reply(201, {
    id: bookingId, message: "Your booking request has been received. Your reservation is not confirmed; MZS Group will respond after review.",
  });
}
