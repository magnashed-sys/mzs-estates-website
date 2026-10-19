import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { isPhase3aPreviewIsolated } from "../../../lib/security/phase3a-preview-isolation";
import ApiCheck from "./ApiCheck";

export const dynamic = "force-dynamic";

export default async function StagingApiCheckPage() {
  if (process.env.VERCEL_ENV !== "preview" || !isPhase3aPreviewIsolated()) notFound();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return <main><h1>Sign in required</h1><a href="/login">Sign in with the Phase 3A client test account</a></main>;
  if (user.app_metadata?.mzs_phase3a_test !== true ||
      !/^phase3a-test-.*@example\.invalid$/.test(user.email ?? "")) notFound();
  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id",user.id).single();
  if (!profile?.is_active || !["client","partner"].includes(profile.role)) notFound();
  return <ApiCheck />;
}
