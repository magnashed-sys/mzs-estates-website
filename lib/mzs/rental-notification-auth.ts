import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../supabase/server";
import { rentalMailEnvironment } from "./rental-notifications";

export const rentalJson = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

export async function rentalAdministrator(request: NextRequest, mutation = false) {
  if (mutation && request.headers.get("origin") !== request.nextUrl.origin)
    return { error: rentalJson(403, { error: "Origin verification failed" }) };
  try { rentalMailEnvironment(); } catch { return { error: rentalJson(503, { error: "Rental mail environment unavailable" }) }; }
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return { error: rentalJson(401, { error: "Authentication required" }) };
  const { data: profile, error: profileError } = await db.from("profiles").select("role,is_active").eq("id", data.user.id).single();
  if (profileError || profile?.role !== "admin" || profile.is_active !== true)
    return { error: rentalJson(403, { error: "Administrator access required" }) };
  return { db };
}
