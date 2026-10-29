
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";

export default async function GroupHome() {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p>{adminT("Group Administrator access required.")}</p>;
  const { data: profile } = await supabase.from("profiles")
    .select("role,is_active").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return <p>{adminT("Group Administrator access required.")}</p>;
  }
  return <><p className="mzsEyebrow">{adminT("GROUP ADMINISTRATION / PHASE 3A")}</p>
    <h1>{adminT("Two specialist platforms. One private group.")}</h1>
    <p className="mzsIntro">{adminT("Select a business division. Your private customer permissions remain unchanged.")}</p>
    <section className="mzsCards" aria-label={adminT("Business divisions")}>
      <Link href="/admin/group/estates"><small>{adminT("01 / REAL ESTATE")}</small><h2>{adminT("MZS Estates")}</h2>
        <p>{adminT("Properties, private rentals, sales and development projects.")}</p><span>{adminT("Enter Estates →")}</span></Link>
      <Link href="/admin/group/capital"><small>{adminT("02 / PRIVATE CAPITAL")}</small><h2>{adminT("MZS Capital")}</h2>
        <p>{adminT("Own and external investments, financing and private capital enquiries.")}</p><span>{adminT("Enter Capital →")}</span></Link>
    </section>
    {process.env.VERCEL_ENV === "preview" && <p className="mzsFootnote">
      {adminT("STAGING ONLY ·")} <Link href="/admin/group/capital-access">{adminT("Capital access pilot →")}</Link>
      {" "}{adminT("Grant and revoke Capital rights for synthetic test accounts.")}</p>}
    <p className="mzsFootnote">{adminT("Group Administration is restricted to existing active Group Administrators.")}</p>
  </>;
}
