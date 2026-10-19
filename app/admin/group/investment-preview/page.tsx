import { createClient } from "../../../../lib/supabase/server";
import { notFound } from "next/navigation";
import VillaCanJuanInvestment from "../../../private/projects/[slug]/VillaCanJuanInvestment";
import { isPhase3aPreviewIsolated } from "../../../../lib/security/phase3a-preview-isolation";

export const dynamic = "force-dynamic";
// Require an active Group Administrator independently of the shared layout.
export default async function InvestmentPreview() {
  if (process.env.VERCEL_ENV !== "preview" || !isPhase3aPreviewIsolated()) notFound();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) notFound();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).single();
  if (profileError || profile?.role !== "admin" || profile.is_active !== true) notFound();
  return <VillaCanJuanInvestment allowInvestment={true} allowAcquisition={true} />;
}
