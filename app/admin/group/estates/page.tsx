import Link from "next/link";
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
      <Link href="/admin/group/estates/properties"><small>PROPERTY REGISTER</small><h2>Ownership &amp; units</h2>
        <p>View property owners, individual units, recorded tenants and rental amounts.</p><span>Open property register →</span></Link>
      <Link href="/admin?tab=projects"><small>EXISTING ADMINISTRATION</small><h2>Projects & access</h2>
        <p>Continue managing existing property presentations, project content and client permissions.</p><span>Open existing projects →</span></Link>
      <Link href="/admin?tab=bookings"><small>PROTECTED WORKFLOWS</small><h2>Rental bookings</h2>
        <p>Existing calendars and reservation workflows remain in their original administration.</p><span>Open bookings →</span></Link>
    </section>
    <p className="mzsFootnote">The ownership register is available to active Group Administrators.</p>
    <Link href="/admin/group">← Group overview</Link>
  </>;
}
