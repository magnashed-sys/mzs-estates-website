
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { isPhase3aPreviewIsolated } from "../../../../lib/security/phase3a-preview-isolation";
import CapitalAccessPilot from "./CapitalAccessPilot";

export const dynamic = "force-dynamic";

// Intentionally restricted to isolated Vercel Preview. It is not a
// Production-ready department administration interface.
export default async function CapitalAccessPage() {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  if (process.env.VERCEL_ENV !== "preview" || !isPhase3aPreviewIsolated()) {
    return <p>{adminT("Department access pilot is available only in isolated Staging Preview.")}</p>;
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return <p>{adminT("Group Administrator access required.")}</p>;
  const { data: profile } = await supabase.from("profiles")
    .select("role,is_active").eq("id",user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return <p>{adminT("Group Administrator access required.")}</p>;
  }

  return <>
    <p className="mzsEyebrow">{adminT("MZS CAPITAL / ISOLATED STAGING")}</p>
    <h1>{adminT("Capital Access Pilot")}</h1>
    <p className="mzsIntro">{adminT("Assign or revoke Capital administration for synthetic Staging test accounts. Every change is authorised and audited inside Supabase.")}</p>
    <CapitalAccessPilot />
    <p className="mzsFootnote">
      {adminT("Use test accounts only. Do not grant rights to existing clients or partners. No Production credentials or database permissions are used here.")}</p>
    <Link href="/admin/group">{adminT("← Group overview")}</Link>
  </>;
}
