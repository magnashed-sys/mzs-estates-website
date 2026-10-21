import { NextRequest, NextResponse } from "next/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const response = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers });
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const displayDate = (s: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" })
  .format(new Date(s + "T12:00:00Z"));
const euro = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n);

export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || request.headers.get("origin") !== request.nextUrl.origin)
    return response(403, { error: "Origin verification failed" });
  let bookingId: unknown;
  try { ({ bookingId } = await request.json()); } catch { return response(400, { error: "Invalid request" }); }
  if (typeof bookingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId))
    return response(400, { error: "Invalid booking reference" });
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return response(401, { error: "Authentication required" });
  const { data: profile } = await db.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true)
    return response(403, { error: "Administrator access required" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return response(503, { error: "Mail service unavailable" });
  const service = adminClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: booking, error: bookingError } = await service.from("rental_bookings")
    .select("id,user_id,project_id,check_in,check_out,guest_count,quoted_total_eur,status,is_test")
    .eq("id", bookingId).single();
  if (bookingError || !booking || booking.status !== "confirmed" || booking.is_test)
    return response(409, { error: "A confirmed live booking is required" });

  // The primary key protects against accidental duplicate confirmations.
  const { error: claimError } = await service.from("rental_confirmation_mail_claims")
    .insert({ booking_id: booking.id, delivery_status: "pending" });
  if (claimError) {
    if (claimError.code === "23505") return response(200, { alreadyProcessed: true });
    return response(503, { error: "Confirmation could not be queued" });
  }

  try {
    const [{ data: guest, error: guestError }, { data: property, error: propertyError }] = await Promise.all([
      service.from("profiles").select("email,full_name").eq("id", booking.user_id).single(),
      service.from("projects").select("title").eq("id", booking.project_id).single(),
    ]);
    if (guestError || propertyError || !guest?.email || !property?.title) throw new Error("Booking details unavailable");
    const host = process.env.MZS_SMTP_HOST || process.env.SMTP_HOST;
    const port = Number(process.env.MZS_SMTP_PORT || process.env.SMTP_PORT || "587");
    const user = process.env.MZS_SMTP_USER || process.env.SMTP_USER;
    const pass = process.env.MZS_SMTP_PASSWORD || process.env.SMTP_PASSWORD;
    const from = process.env.MZS_SMTP_FROM || process.env.SMTP_FROM ||
      (user?.includes("@") ? "MZS Group <" + user + ">" : undefined);
    if (!host || !user || !pass || !from || ![465, 587].includes(port)) throw new Error("Mail configuration missing");
    const nights = Math.round((Date.parse(booking.check_out + "T12:00:00Z") -
      Date.parse(booking.check_in + "T12:00:00Z")) / 86400000);
    const details: [string, string][] = [
      ["Property", property.title], ["Check-in", displayDate(booking.check_in)],
      ["Check-out", displayDate(booking.check_out)], ["Nights", String(nights)],
      ["Guests", String(booking.guest_count)], ["Confirmed amount", euro(Number(booking.quoted_total_eur))],
      ["Booking reference", booking.id],
    ];
    const rows = details.map(([name, value]) => "<tr><td style='padding:12px;color:#d5c09a'>" + escape(name) +
      "</td><td style='padding:12px'>" + escape(value) + "</td></tr>").join("");
    const html = "<!doctype html><html lang='en'><body style='background:#0b0b0a;color:#eeeae2;font-family:Arial,sans-serif'>" +
      "<div style='max-width:580px;margin:28px auto;padding:36px;background:#151411;border:1px solid #514839'>" +
      "<p style='color:#d5c09a;letter-spacing:4px;text-align:center'>MZS GROUP</p>" +
      "<h1 style='font:normal 33px Georgia,serif;text-align:center'>Your reservation is confirmed.</h1>" +
      "<p style='line-height:1.8'>Dear " + escape(guest.full_name?.split(" ")[0] || "Guest") +
      ", your booking has been personally approved by MZS Group. We look forward to welcoming you.</p>" +
      "<table style='width:100%'>" + rows + "</table>" +
      "<p style='margin:40px 0;text-align:center'><a style='background:#d5c09a;color:#111;padding:16px;text-decoration:none' href='https://www.mzsgroup.com/private/reservations'>VIEW MY RESERVATION →</a></p>" +
      "<p style='color:#d5c09a;font-size:11px;text-align:center;letter-spacing:2px'>PRIVATE · INDEPENDENT · INTERNATIONAL</p></div></body></html>";
    const text = "Dear " + (guest.full_name?.split(" ")[0] || "Guest") +
      ",\n\nYour reservation has been approved and confirmed by MZS Group.\n\n" +
      details.map(([name, value]) => name + ": " + value).join("\n") +
      "\n\nView your reservation: https://www.mzsgroup.com/private/reservations\n\nMZS Group";
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, requireTLS: port === 587,
      auth: { user, pass }, tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 8000, greetingTimeout: 6000, socketTimeout: 10000,
    });
    try {
      const sent = await transport.sendMail({
        from, to: guest.email, subject: "Your reservation is confirmed | MZS Group", text, html,
      });
      if (!sent.accepted?.some(address => (typeof address === "string" ? address : address.address).toLowerCase() === guest.email.toLowerCase()))
        throw new Error("Message not accepted by SMTP server");
    } finally { transport.close(); }
    await service.from("rental_confirmation_mail_claims").update({
      delivery_status: "accepted", delivered_at: new Date().toISOString(),
    }).eq("booking_id", booking.id);
    return response(200, { accepted: true });
  } catch (error) {
    console.error("[MZS rental confirmation] Send failed", {
      bookingId, category: error instanceof Error ? error.name : "unknown",
    });
    await service.from("rental_confirmation_mail_claims").update({ delivery_status: "failed" }).eq("booking_id", booking.id);
    return response(502, { error: "Booking is confirmed, but confirmation email was not accepted. Check mail logs." });
  }
}
