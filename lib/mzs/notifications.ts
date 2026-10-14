import "server-only";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

type EventType = "application_received" | "account_activated" | "new_project_access";
type EventRow = {
  id: string;
  user_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  attempts: number;
};
export type DeliveryResult =
  | { status: "sent"; id: string }
  | { status: "none" | "not_configured" | "failed"; id?: string };

const SITE = "https://www.mzsgroup.eu";
const GOLD = "#d5c09a";
const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const str = (value: unknown) => typeof value === "string" ? value.slice(0, 500) : "";
const strings = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string").slice(0, 100)
  : [];

function mailSettings() {
  const host = process.env.MZS_SMTP_HOST;
  const port = Number(process.env.MZS_SMTP_PORT || "587");
  const user = process.env.MZS_SMTP_USER;
  const pass = process.env.MZS_SMTP_PASSWORD;
  const from = process.env.MZS_SMTP_FROM;
  if (!host || !user || !pass || !from || ![465, 587].includes(port)) return null;
  return { host, port, user, pass, from };
}

function template(event: EventRow, recipientName: string) {
  const name = recipientName.trim().split(/\s+/)[0] || "Member";
  const eName = escapeHtml(name);
  let subject = "";
  let headline = "";
  let intro = "";
  let plain = "";
  let link = SITE + "/login";
  let linkTitle = "PRIVATE LOGIN";
  let detailsHtml = "";

  if (event.event_type === "application_received") {
    subject = "New private access request | MZS Group";
    headline = "A new relationship request.";
    intro = "A new account has been registered and is awaiting email verification and individual approval.";
    const requester = escapeHtml(str(event.payload?.requester) || "New applicant");
    detailsHtml = "<p style='color:#d5c09a'>Applicant: " + requester + "</p>";
    plain = "A new account request has been received. Review applications in the MZS administrator dashboard.";
    link = SITE + "/admin?tab=relationships";
    linkTitle = "OPEN ADMIN DASHBOARD";
  } else if (event.event_type === "account_activated") {
    subject = "Your MZS Group account is now active";
    headline = "Welcome to your private collection.";
    intro = "Your MZS Group account has been approved and activated. You can now access the opportunities selected for you.";
    const projects = strings(event.payload?.projects);
    detailsHtml = projects.length
      ? "<p style='color:#d5c09a'>Your assigned projects</p><ul style='color:#d0c6b8;line-height:2'>" +
        projects.map(project => "<li>" + escapeHtml(project) + "</li>").join("") + "</ul>"
      : "";
    plain = "Your account is now active." +
      (projects.length ? " Assigned projects: " + projects.join(", ") + "." : "") +
      " Sign in to your MZS Group dashboard.";
  } else if (event.event_type === "new_project_access") {
    const project = str(event.payload?.project);
    const types = strings(event.payload?.added_types);
    subject = "New private project access | MZS Group";
    headline = "New opportunities in your collection.";
    intro = "Additional private project access has been granted to your MZS Group account.";
    detailsHtml = "<p style='color:#d5c09a'>" + escapeHtml(project) + "</p>" +
      (types.length ? "<p style='color:#d0c6b8'>" + types.map(escapeHtml).join(" · ") + "</p>" : "");
    plain = "New access is available: " + project +
      (types.length ? " (" + types.join(", ") + ")." : ".") +
      " Sign in to review your updated collection.";
    link = SITE + "/private";
    linkTitle = "EXPLORE MY COLLECTION";
  } else {
    throw new Error("Unsupported notification type");
  }

  const html = "<!DOCTYPE html><html lang='en'><body style='margin:0;background:#0b0b0a;color:#f4f0e7;font-family:Arial,Helvetica,sans-serif'>" +
    "<div style='max-width:590px;margin:40px auto;padding:40px 30px;background:#11100e;border:1px solid #3d3529'>" +
    "<div style='text-align:center;color:" + GOLD + ";font-family:Georgia,serif;font-size:35px;letter-spacing:5px'>MZS</div>" +
    "<div style='text-align:center;letter-spacing:5px;font-size:10px;color:#d0c6b8;margin:10px 0 35px'>GROUP</div>" +
    "<p style='text-align:center;letter-spacing:3px;color:" + GOLD + ";font-size:11px'>PRIVATE ACCESS</p>" +
    "<h1 style='font-family:Georgia,serif;font-weight:normal;text-align:center;font-size:33px'>" + escapeHtml(headline) + "</h1>" +
    "<p style='line-height:1.9;color:#d0c6b8'>Dear " + eName + ",</p>" +
    "<p style='line-height:1.9;color:#d0c6b8'>" + escapeHtml(intro) + "</p>" +
    detailsHtml +
    "<p style='margin:40px 0;text-align:center'><a href='" + link +
    "' style='background:" + GOLD + ";color:#0b0b0a;padding:18px 24px;text-decoration:none;letter-spacing:1px;font-size:12px;font-weight:bold'>" +
    linkTitle + " →</a></p>" +
    "<p style='font-size:11px;color:#aaa398;line-height:1.9;text-align:center'>This private message is intended for the named recipient. Do not forward account security messages.</p>" +
    "<hr style='border:0;border-top:1px solid #514839;margin:30px 0' />" +
    "<p style='text-align:center;font-size:10px;color:" + GOLD + ";letter-spacing:2px'>PRIVATE · INDEPENDENT · INTERNATIONAL</p>" +
    "<p style='text-align:center;font-size:11px;color:#aaa398'>MZS GROUP · BY INVITATION ONLY</p>" +
    "</div></body></html>";

  return { subject, html, text: "Dear " + name + ",\n\n" + plain + "\n\n" + link + "\n\nMZS Group" };
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service unavailable");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Consume one due event using the database's SKIP LOCKED claim function. */
export async function deliverOnce(eventId?: string): Promise<DeliveryResult> {
  const config = mailSettings();
  if (!config) return { status: "not_configured" };
  const admin = serviceClient();
  const { data: claimed, error: claimError } = await admin.rpc("mzs_claim_outbox", {
    p_id: eventId || null,
  });
  if (claimError) throw new Error("Unable to claim notification");
  const event = (Array.isArray(claimed) ? claimed[0] : undefined) as EventRow | undefined;
  if (!event) return { status: "none" };

  try {
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("full_name,email,is_active").eq("id", event.user_id).single();
    if (profileError || !profile?.email || profile.is_active !== true) {
      throw new Error("Recipient profile unavailable");
    }
    const message = template(event, profile.full_name || "Member");
    const mailer = nodemailer.createTransport({
      host: config.host, port: config.port, secure: config.port === 465,
      requireTLS: config.port === 587,
      auth: { user: config.user, pass: config.pass },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 8000, greetingTimeout: 6000, socketTimeout: 10000,
    });
    await mailer.sendMail({
      from: config.from, to: profile.email,
      subject: message.subject, html: message.html, text: message.text,
    });
    const { error: savedError } = await admin.from("mzs_mail_outbox")
      .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
      .eq("id", event.id).eq("status", "sending");
    if (savedError) throw new Error("Notification sent but delivery status is uncertain");
    return { status: "sent", id: event.id };
  } catch (error) {
    // Retry with backoff; never reverse the permission change because mail failed.
    const retry = Math.min(86400, Math.pow(2, Math.max(0, event.attempts - 1)) * 180);
    await admin.from("mzs_mail_outbox").update({
      status: event.attempts >= 6 ? "failed" : "pending",
      next_attempt_at: new Date(Date.now() + retry * 1000).toISOString(),
      last_error: "Delivery requires attention or retry",
    }).eq("id", event.id).eq("status", "sending");
    console.error("[MZS mail] Delivery unsuccessful", {
      event: event.event_type,
      class: error instanceof Error ? error.name : "unknown",
    });
    return { status: "failed", id: event.id };
  }
}

/** Best-effort immediate delivery after an approved operation; the queue is authoritative. */
export async function deliverForRecipient(
  userId: string, eventType: EventType, limit = 3
): Promise<DeliveryResult[]> {
  const admin = serviceClient();
  const { data, error } = await admin.from("mzs_mail_outbox")
    .select("id").eq("user_id", userId).eq("event_type", eventType)
    .eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Unable to read queued notifications");
  const results: DeliveryResult[] = [];
  for (const item of data || []) results.push(await deliverOnce(item.id));
  return results;
}
