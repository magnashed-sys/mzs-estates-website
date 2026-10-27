import { NextRequest } from "next/server";
import { rentalAdministrator, rentalJson } from "../../../../lib/mzs/rental-notification-auth";
import { deliverRentalChange } from "../../../../lib/mzs/rental-notifications";
export const runtime = "nodejs";
export const maxDuration = 60;

const fields: Record<string, string[]> = {
  mzs_admin_cancel_booking_dossier: ["p_booking_id", "p_reason", "p_fingerprint"],
  admin_modify_live_rental_booking: ["p_booking_id", "p_check_in", "p_check_out", "p_guest_count",
    "p_expected_check_in", "p_expected_check_out", "p_expected_guest_count", "p_admin_notes"],
  admin_cancel_live_rental_booking: ["p_booking_id", "p_reason"],
  review_booking_cancellation: ["p_request_id", "p_decision"],
};

export async function POST(request: NextRequest) {
  const auth = await rentalAdministrator(request, true);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return rentalJson(400, { error: "Invalid request" }); }
  if (!body || typeof body.functionName !== "string" || !Object.hasOwn(fields, body.functionName) ||
      !body.args || typeof body.args !== "object" || Array.isArray(body.args))
    return rentalJson(400, { error: "Invalid booking action" });
  const args: Record<string, unknown> = {};
  for (const key of fields[body.functionName]) if (Object.hasOwn(body.args, key)) args[key] = body.args[key];
  let bookingId = args.p_booking_id;
  if (body.functionName === "review_booking_cancellation") {
    const { data } = await auth.db.from("rental_cancellation_requests").select("booking_id").eq("id", args.p_request_id).single();
    bookingId = data?.booking_id;
  }
  if (typeof bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(bookingId))
    return rentalJson(400, { error: "Invalid booking reference" });
  // The unchanged RPC retains validation, availability, price and audit behaviour.
  const { data, error } = await auth.db.rpc(body.functionName, args);
  if (error) return rentalJson(409, { error: error.message });
  if (body.functionName === "mzs_admin_cancel_booking_dossier" && data?.emailQueued !== true)
    return rentalJson(200, { result: data, delivery: "not_required" });
  let delivery: string = "queued";
  try { delivery = await deliverRentalChange(bookingId); } catch { /* Committed outbox survives failures. */ }
  return rentalJson(200, { result: data, delivery });
}
