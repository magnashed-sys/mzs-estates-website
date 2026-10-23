import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { rentalJson } from "../../../../../lib/mzs/rental-notification-auth";
import { deliverRentalChange } from "../../../../../lib/mzs/rental-notifications";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const expected = Buffer.from("Bearer " + (process.env.CRON_SECRET || ""));
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (!process.env.CRON_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return rentalJson(401, { error: "Unauthorised" });
  const started = Date.now();
  const results = [];
  for (let i = 0; i < 20 && Date.now() - started < 30000; i++) {
    try {
      const result = await deliverRentalChange();
      results.push(result);
      if (result === "none" || result === "disabled") break;
    } catch { return rentalJson(503, { error: "Queue unavailable", results }); }
  }
  return rentalJson(200, { results });
}
