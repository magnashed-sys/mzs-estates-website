import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAGING_SUPABASE = "https://senonkpxdtlhyhrubicg.supabase.co";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  // This diagnostic is intentionally unavailable from the production website.
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stagingTarget = url === STAGING_SUPABASE;
  const registrationEnabled = process.env.MZS_ACCOUNT_REGISTRATION_ENABLED === "true";

  if (!stagingTarget || !pub || !service) {
    return NextResponse.json({
      isolatedStagingDatabase: stagingTarget,
      publicKeyAccepted: false,
      serviceKeyAccepted: false,
      testProjectsAvailable: false,
      registrationEnabled,
      readyForIsolatedTesting: false,
      note: "Check the branch-specific Preview Supabase environment variables.",
    }, { status: 503, headers });
  }

  try {
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const anonymous = createClient(url, pub, options);
    const privileged = createClient(url, service, options);
    const [publicProbe, adminProbe] = await Promise.all([
      anonymous.rpc("is_admin"),
      privileged.from("projects").select("slug")
        .like("slug", "staging-test-%").limit(4),
    ]);

    const publicKeyAccepted = !publicProbe.error && publicProbe.data === false;
    const serviceKeyAccepted = !adminProbe.error;
    const testProjectsAvailable = serviceKeyAccepted &&
      (adminProbe.data?.length ?? 0) >= 3;

    const readyForIsolatedTesting =
      stagingTarget && publicKeyAccepted &&
      serviceKeyAccepted && testProjectsAvailable;

    return NextResponse.json({
      isolatedStagingDatabase: stagingTarget,
      publicKeyAccepted,
      serviceKeyAccepted,
      testProjectsAvailable,
      registrationEnabled,
      readyForIsolatedTesting,
      note: registrationEnabled
        ? "Staging credential checks passed; separately test Auth email verification."
        : "Staging credential checks complete. Registration remains safely disabled.",
    }, { status: readyForIsolatedTesting ? 200 : 503, headers });
  } catch {
    return NextResponse.json({
      isolatedStagingDatabase: stagingTarget,
      publicKeyAccepted: false,
      serviceKeyAccepted: false,
      testProjectsAvailable: false,
      registrationEnabled,
      readyForIsolatedTesting: false,
      note: "Unable to complete the Staging credential checks.",
    }, { status: 503, headers });
  }
}
