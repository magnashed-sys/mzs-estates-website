import { russianRentalMail } from "./russian-rental-mail";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export type RentalEvent = {
  id: string; booking_id: string; recipient_user_id: string; recipient_email: string | null;
  kind: "modified" | "cancelled"; attempts: number; claim_token: string;
  payload: { property: string; check_in: string; check_out: string; guests: number; total_eur: number };
};
export type RentalDelivery = "none" | "accepted" | "captured" | "retry" | "failed" | "uncertain" | "disabled";
const STAGING = "https://senonkpxdtlhyhrubicg.supabase.co";
const PRODUCTION = "https://ptrnjzmcehrhbsfxntgw.supabase.co";

export function rentalMailEnvironment() {
  const env = process.env;
  if (env.MZS_RENTAL_NOTIFICATIONS_ENABLED !== "true") throw new Error("Rental notifications disabled");
  if (env.NEXT_PUBLIC_SUPABASE_URL === STAGING && env.VERCEL_ENV !== "production" &&
      env.MZS_RENTAL_MAIL_MODE === "capture") {
    const host = env.VERCEL_URL;
    if (env.VERCEL_ENV === "preview" && (!host || !/^mzs-group-[a-z0-9-]+\.vercel\.app$/i.test(host)))
      throw new Error("Isolated Preview URL required");
    return { mode: "capture" as const, site: host ? `https://${host}` : "http://localhost:3000" };
  }
  if (env.VERCEL_ENV === "production" && env.NEXT_PUBLIC_SUPABASE_URL === PRODUCTION &&
      env.MZS_RENTAL_MAIL_MODE === "smtp") return { mode: "smtp" as const, site: "https://www.mzsgroup.com" };
  throw new Error("Rental mail environment does not match database");
}

export function rentalService() {
  rentalMailEnvironment();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Rental mail service unavailable");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key,
    { auth: { persistSession: false, autoRefreshToken: false } });
}

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" })
  .format(new Date(value + "T12:00:00Z"));

/** Explicit projection only: never serialize a booking, audit record or reason into email. */
export function rentalChangeTemplate(event: RentalEvent, site: string, locale: unknown = "en") {
  const p = event.payload;
  const cancelled = event.kind === "cancelled";
  if (!["modified", "cancelled"].includes(event.kind) || !p.property ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(p.check_out) ||
      !Number.isInteger(p.guests) || p.guests < 1 || typeof p.total_eur !== "number" || !Number.isFinite(p.total_eur) || p.total_eur < 0)
    throw new Error("Invalid notification snapshot");
  if (locale === "ru") return russianRentalMail(event.kind, {
    property:p.property, checkIn:p.check_in, checkOut:p.check_out, guests:p.guests,
    total:p.total_eur, reference:event.booking_id,
  }, site);
  const headline = cancelled ? "Your reservation is cancelled." : "Your reservation has been updated.";
  const intro = cancelled
    ? "Your reservation has been cancelled by MZS Group and is no longer valid. Your earlier booking confirmation is no longer valid. Please do not travel on the basis of that confirmation."
    : "MZS Group has updated your confirmed reservation. The current details below replace those in your previous confirmation.";
  const rows: [string, string][] = [
    ["Status", cancelled ? "CANCELLED — NO LONGER VALID" : "CONFIRMED — UPDATED"],
    ["Property", p.property], ["Check-in", date(p.check_in)], ["Check-out", date(p.check_out)],
    ["Nights", String(Math.round((Date.parse(p.check_out) - Date.parse(p.check_in)) / 86400000))],
    ["Guests", String(p.guests)],
    [cancelled ? "Previously confirmed amount" : "Confirmed amount", new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(p.total_eur))],
    ["Booking reference", event.booking_id],
  ];
  const footer = cancelled
    ? "Any payment or refund arrangements will be handled separately. Contact MZS Group if you need assistance."
    : "You can view the latest status of your reservation in your private account. Contact MZS Group if you need assistance.";
  const link = site + "/private/reservations";
  const html = `<!doctype html><html lang="en"><head><meta name="color-scheme" content="dark light"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background-color:#0b0b0a;font-family:Arial,sans-serif;color:#eeeae2">
<div style="max-width:580px;margin:28px auto;padding:32px 24px;background-color:#151411;border:1px solid #514839">
<p style="color:#d5c09a!important;letter-spacing:4px;text-align:center">MZS GROUP</p>
<h1 style="font:normal 32px Georgia,serif;text-align:center;color:#eeeae2!important">${headline}</h1>
<p style="line-height:1.8;color:#eeeae2!important">Dear Guest,</p>
<p style="line-height:1.8;color:#eeeae2!important">${intro}</p>
<table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([label, value]) =>
    `<tr><td style="padding:12px 8px;color:#d5c09a!important;vertical-align:top">${escape(label)}</td><td style="padding:12px 8px;color:#eeeae2!important;background-color:#151411;overflow-wrap:anywhere">${escape(value)}</td></tr>`).join("")}</table>
<p style="line-height:1.8;color:#eeeae2!important">${footer}</p>
<p style="margin:36px 0;text-align:center"><a href="${escape(link)}" style="display:inline-block;background-color:#d5c09a;color:#111111!important;padding:16px;text-decoration:none">VIEW MY RESERVATION</a></p>
<p style="color:#d5c09a!important;font-size:11px;text-align:center;letter-spacing:2px">PRIVATE · INDEPENDENT · INTERNATIONAL</p></div></body></html>`;
  return {
    subject: cancelled ? "Your reservation is cancelled | MZS Group" : "Your reservation has been updated | MZS Group",
    html, text: ["MZS GROUP", "", "Dear Guest,", "", intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", footer, "", link].join("\n"),
  };
}

/** Only definite non-acceptance is safe to retry. A lost DATA reply is ambiguous. */
export function classifyRentalMailFailure(error: unknown): "retry" | "failed" | "uncertain" {
  const e = error as { responseCode?: number; command?: string; code?: string; syscall?: string } | null;
  if (e?.responseCode && e.responseCode >= 400 && e.responseCode < 500) return "retry";
  if (e?.responseCode && e.responseCode >= 500 && e.responseCode < 600) return "failed";
  if (e?.code === "EAUTH" || e?.code === "EENVELOPE") return "failed";
  // Nodemailer also labels post-DATA socket loss as CONN: that is NOT proof of non-delivery.
  if (["EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO"].includes(e?.command ?? "") ||
      ["EDNS", "ECONNREFUSED"].includes(e?.code ?? "") || e?.syscall === "connect") return "retry";
  return "uncertain";
}

export async function deliverRentalChange(bookingId?: string): Promise<RentalDelivery> {
  let environment: ReturnType<typeof rentalMailEnvironment>;
  try { environment = rentalMailEnvironment(); } catch { return "disabled"; }
  const db = rentalService();
  const { data, error } = await db.rpc("claim_rental_change_notification", { p_booking_id: bookingId ?? null });
  if (error) throw new Error("Rental notification claim failed");
  const event = data?.[0] as RentalEvent | undefined;
  if (!event) return "none";
  const finish = async (status: RentalDelivery, category?: string) => {
    if (status === "retry" && event.attempts >= 5) status = "failed";
    const delay = Math.min(3600, 60 * 2 ** Math.max(0, event.attempts - 1));
    const { data: saved, error: saveError } = await db.from("rental_change_notifications").update({
      status, last_error: category ?? null,
      available_at: new Date(Date.now() + delay * 1000).toISOString(),
      completed_at: ["accepted", "captured"].includes(status) ? new Date().toISOString() : null,
    }).eq("id", event.id).eq("claim_token", event.claim_token).eq("status", "sending").select("id");
    // A missed acknowledgement must not be reported as sent or reset to retry.
    if (saveError || saved?.length !== 1) return "uncertain" as const;
    return status;
  };
  let message: ReturnType<typeof rentalChangeTemplate>;
  try {
    // Resolve against the actual booking owner, never a browser-supplied recipient.
    const [{ data: booking, error: bookingError }, { data: auth, error: userError }] = await Promise.all([
      db.from("rental_bookings").select("user_id,is_test").eq("id", event.booking_id).single(),
      db.auth.admin.getUserById(event.recipient_user_id),
    ]);
    const email = auth?.user?.email?.trim().toLowerCase();
    if (bookingError || userError) return await finish("retry", "recipient_lookup_failed");
    if (!booking || booking.is_test || booking.user_id !== event.recipient_user_id || !email ||
        email !== event.recipient_email || !/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(email))
      return await finish("failed", "recipient_requires_review");
    message = rentalChangeTemplate(event, environment.site, auth.user?.user_metadata?.preferred_language);
  } catch { return await finish("failed", "invalid_notification"); }

  const env = process.env;
  const host = env.MZS_SMTP_HOST || env.SMTP_HOST;
  const port = Number(env.MZS_SMTP_PORT || env.SMTP_PORT || "587");
  const user = env.MZS_SMTP_USER || env.SMTP_USER;
  const pass = env.MZS_SMTP_PASSWORD || env.SMTP_PASSWORD;
  const from = env.MZS_SMTP_FROM || env.SMTP_FROM || (user?.includes("@") ? `MZS Group <${user}>` : undefined);
  if (environment.mode === "smtp" && (!host || !user || !pass || !from || ![465, 587].includes(port)))
    return finish("failed", "smtp_configuration");
  // Capture has no SMTP connection, even if inherited SMTP secrets are present.
  const transport = environment.mode === "capture"
    ? nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" })
    : nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port === 587,
      auth: { user, pass }, tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 8000, greetingTimeout: 6000, socketTimeout: 10000 });
  let result: RentalDelivery;
  let category: string | undefined;
  try {
    const sent = await transport.sendMail({ ...message,
      from: environment.mode === "capture" ? "MZS Group <staging@example.invalid>" : from,
      to: event.recipient_email!,
      messageId: `<rental-${event.id}@notifications.mzsgroup.com>`,
      headers: { "X-MZS-Notification-ID": event.id },
    });
    if (environment.mode === "capture") result = "captured";
    else if (sent.accepted?.some((address: string | { address: string }) =>
      (typeof address === "string" ? address : address.address).toLowerCase() === event.recipient_email)) result = "accepted";
    else { result = "failed"; category = "smtp_recipient_rejected"; }
  } catch (error) {
    result = classifyRentalMailFailure(error);
    if (result === "retry" && event.attempts >= 5) result = "failed";
    category = result === "uncertain" ? "smtp_outcome_unknown" : "smtp_not_accepted";
  } finally { transport.close(); }
  return finish(result, category);
}
