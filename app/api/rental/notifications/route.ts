import { NextRequest, NextResponse } from "next/server";
import { rentalAdministrator, rentalJson } from "../../../../lib/mzs/rental-notification-auth";
import { deliverRentalChange, rentalChangeTemplate, rentalMailEnvironment, rentalService, RentalEvent } from "../../../../lib/mzs/rental-notifications";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await rentalAdministrator(request);
  if (auth.error) return auth.error;
  const db = rentalService();
  const id = request.nextUrl.searchParams.get("preview");
  if (id) {
    const env = rentalMailEnvironment();
    if (env.mode !== "capture") return rentalJson(404, { error: "Not found" });
    const { data, error } = await db.from("rental_change_notifications").select("*").eq("id", id).single();
    if (error || !data) return rentalJson(404, { error: "Notification not found" });
    return new NextResponse(rentalChangeTemplate(data as RentalEvent, env.site).html, { headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    } });
  }
  const { data, error } = await db.from("rental_change_notifications")
    .select("id,booking_id,kind,status,attempts,last_error,created_at,recipient_email")
    .order("sequence", { ascending: false }).limit(50);
  if (error) return rentalJson(503, { error: "Notification overview unavailable" });
  return rentalJson(200, { notifications: data, capture: rentalMailEnvironment().mode === "capture" });
}

export async function POST(request: NextRequest) {
  const auth = await rentalAdministrator(request, true);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return rentalJson(400, { error: "Invalid request" }); }
  if (body?.action === "resolve") {
    if (body.verified !== true) return rentalJson(400, { error: "Verify delivery logs before resolving" });
    const { data, error } = await auth.db.rpc("resolve_rental_change_notification", {
      p_id: body.id, p_decision: body.decision, p_reason: body.reason,
    });
    return error ? rentalJson(409, { error: error.message }) : rentalJson(200, { status: data });
  }
  if (body?.action !== "dispatch") return rentalJson(400, { error: "Invalid action" });
  try { return rentalJson(200, { status: await deliverRentalChange() }); }
  catch { return rentalJson(503, { error: "Delivery outcome unavailable; refresh notification status" }); }
}
