import Link from "next/link";
import { contractsAvailable } from "../../../../lib/security/estate-contracts";
import { createClient } from "../../../../lib/supabase/server";

export default async function EstatesHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p>Group Administrator access required.</p>;
  const { data: profile } = await supabase.from("profiles")
    .select("role,is_active").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return <p>Group Administrator access required. Estates-only management is not yet enabled.</p>;
  }
  return <><p className="mzsEyebrow">MZS ESTATES / MANAGEMENT</p><h1>Property Cockpit</h1>
    <p className="mzsIntro">Rental, sales and developments — integrated with the existing protected project management.</p>
    <section className="mzsCards">
      {contractsAvailable() && <Link href="/admin/group/estates/contracts"><small>LONG-TERM RENTAL</small><h2>Contracts &amp; invoices</h2><p>Link rental units to agreements and prepare monthly invoice drafts for review.</p><span>Open contracts →</span></Link>}
      <Link href="/admin/group/estates/units"><small>RENTAL REGISTER</small><h2>Rental units</h2><p>Open individual rental units and their linked properties, tenants and rental amounts.</p><span>Open rental units →</span></Link>
      <Link href="/admin/group/estates/properties"><small>PROPERTY REGISTER</small><h2>Ownership &amp; units</h2>
        <p>View property owners, individual units, recorded tenants and rental amounts.</p><span>Open property register →</span></Link>
      <Link href="/admin?tab=projects"><small>EXISTING ADMINISTRATION</small><h2>Projects & access</h2>
        <p>Continue managing existing property presentations, project content and client permissions.</p><span>Open existing projects →</span></Link>
      <Link href="/admin/bookings"><small>CENTRAL BOOKINGS HUB</small><h2>Bookings &amp; reservations</h2>
        <p>Open the central guest and owner-stay register, historic dossiers and recorded booking finances. Requests and the calendar remain one click away.</p><span>Open Bookings →</span></Link>
    </section>
    <p className="mzsFootnote">The ownership register is available to active Group Administrators.</p>
    <Link href="/admin/group">← Group overview</Link>
  </>;
}
