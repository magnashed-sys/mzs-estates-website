import Link from "next/link";
export default function EstatesHome() {
 return <><p className="mzsEyebrow">MZS ESTATES / MANAGEMENT</p><h1>Property Cockpit</h1>
 <p className="mzsIntro">Rental, sales and developments — integrated with the existing protected project management.</p>
 <section className="mzsCards"><Link href="/admin?tab=projects"><small>EXISTING ADMINISTRATION</small><h2>Projects & access</h2><p>Continue managing existing property presentations, project content and client permissions.</p><span>Open existing projects →</span></Link>
 <Link href="/admin?tab=bookings"><small>PROTECTED WORKFLOWS</small><h2>Rental bookings</h2><p>Existing calendars and reservation workflows remain in their original administration.</p><span>Open bookings →</span></Link></section>
 <p className="mzsFootnote">No ownership, calendar or booking data has been migrated. Department-only access is not enabled yet.</p><Link href="/admin/group">← Group overview</Link></>;
}
