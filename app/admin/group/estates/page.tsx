
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import { contractsAvailable } from "../../../../lib/security/estate-contracts";
import { createClient } from "../../../../lib/supabase/server";

export default async function EstatesHome() {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p>{adminT("Group Administrator access required.")}</p>;
  const { data: profile } = await supabase.from("profiles")
    .select("role,is_active").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return <p>{adminT("Group Administrator access required. Estates-only management is not yet enabled.")}</p>;
  }
  return <><p className="mzsEyebrow">{adminT("MZS ESTATES / MANAGEMENT")}</p><h1>{adminT("Property Cockpit")}</h1>
    <p className="mzsIntro">{adminT("Rental, sales and developments — integrated with the existing protected project management.")}</p>
    <section className="mzsCards">
      {contractsAvailable() && <Link href="/admin/group/estates/contracts"><small>{adminT("LONG-TERM RENTAL")}</small><h2>{adminT("Contracts & invoices")}</h2><p>{adminT("Link rental units to agreements and prepare monthly invoice drafts for review.")}</p><span>{adminT("Open contracts →")}</span></Link>}
      <Link href="/admin/group/estates/units"><small>{adminT("RENTAL REGISTER")}</small><h2>{adminT("Rental units")}</h2><p>{adminT("Open individual rental units and their linked properties, tenants and rental amounts.")}</p><span>{adminT("Open rental units →")}</span></Link>
      <Link href="/admin/group/estates/properties"><small>{adminT("PROPERTY REGISTER")}</small><h2>{adminT("Ownership & units")}</h2>
        <p>{adminT("View property owners, individual units, recorded tenants and rental amounts.")}</p><span>{adminT("Open property register →")}</span></Link>
      <Link href="/admin?tab=projects"><small>{adminT("EXISTING ADMINISTRATION")}</small><h2>{adminT("Projects & access")}</h2>
        <p>{adminT("Continue managing existing property presentations, project content and client permissions.")}</p><span>{adminT("Open existing projects →")}</span></Link>
      <Link href="/admin/bookings"><small>{adminT("CENTRAL BOOKINGS HUB")}</small><h2>{adminT("Bookings & reservations")}</h2>
        <p>{adminT("Open the central guest and owner-stay register, historic dossiers and recorded booking finances. Requests and the calendar remain one click away.")}</p><span>{adminT("Open Bookings →")}</span></Link>
    </section>
    <p className="mzsFootnote">{adminT("The ownership register is available to active Group Administrators.")}</p>
    <Link href="/admin/group">{adminT("← Group overview")}</Link>
  </>;
}
