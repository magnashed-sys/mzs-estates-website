import { NextRequest, NextResponse } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { createClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (status: number, data: Record<string, unknown>) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fields = {
  full_name: 160, phone: 40, street_address: 160, house_number: 24,
  address_addition: 80, postal_code: 24, city: 120, region: 120, country: 120,
} as const;
type Field = keyof typeof fields;

export async function PATCH(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return reply(403, { error: "Request origin could not be verified." });
  const db = await createClient();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) return reply(401, { error: "Authentication required." });
  const { data: admin } = await db.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
  if (admin?.role !== "admin" || admin.is_active !== true)
    return reply(403, { error: "Administrator access required." });
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return reply(400, { error: "Invalid request." }); }
  const userId = body.user_id;
  if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))
    return reply(400, { error: "Invalid relationship." });
  const update: Record<Field, string | null> = {} as Record<Field, string | null>;
  for (const key of Object.keys(body)) {
    if (key === "user_id") continue;
    if (!(key in fields)) return reply(400, { error: "Unsupported field." });
    const field = key as Field;
    const value = body[key];
    if (typeof value !== "string" || value.length > fields[field])
      return reply(400, { error: "Invalid " + field + "." });
    update[field] = value.trim() || null;
  }
  if (!update.full_name) return reply(400, { error: "Full name is required." });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply(503, { error: "Service unavailable." });
  const service = serviceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: target, error: lookupError } = await service.from("profiles")
    .select("id,role").eq("id", userId).single();
  if (lookupError || !target || !["client","partner"].includes(target.role))
    return reply(404, { error: "Client or partner relationship not found." });
  const { error: contactError } = await service.from("mzs_member_contact_details")
    .upsert({ user_id: userId, phone: update.phone, street_address: update.street_address,
      house_number: update.house_number, address_addition: update.address_addition,
      postal_code: update.postal_code, city: update.city, region: update.region,
      country: update.country }, { onConflict: "user_id" });
  if (contactError) return reply(503, { error: "Contact details could not be saved." });
  const { error: nameError } = await service.from("profiles").update({ full_name: update.full_name }).eq("id", userId);
  if (nameError) return reply(503, { error: "Contact saved but full name could not be updated. Please reload." });
  return reply(200, { saved: true });
}
