import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { verifyExistingSmtpMailbox } from "../../../../../lib/mzs/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role,is_active").eq("id", auth.user.id).single();
    if (profileError || !profile || profile.role !== "admin" || profile.is_active !== true) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403, headers });
    }

    const mail = await verifyExistingSmtpMailbox();
    return NextResponse.json(mail, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Unable to check mail transport" }, { status: 503, headers });
  }
}
