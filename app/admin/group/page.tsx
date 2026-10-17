import Link from "next/link";
export default function GroupHome() {
  return <><p className="mzsEyebrow">GROUP ADMINISTRATION / PHASE 3A</p>
    <h1>Two specialist platforms. One private group.</h1>
    <p className="mzsIntro">Select a business division. The current administration and customer permissions remain unchanged.</p>
    <section className="mzsCards" aria-label="Business divisions">
      <Link href="/admin/group/estates"><small>01 / REAL ESTATE</small><h2>MZS Estates</h2><p>Properties, private rentals, sales and development projects.</p><span>Enter Estates →</span></Link>
      <Link href="/admin/group/capital"><small>02 / PRIVATE CAPITAL</small><h2>MZS Capital</h2><p>Own and external investments, financing and private capital enquiries.</p><span>Enter Capital →</span></Link>
    </section><p className="mzsFootnote">Role separation is under Staging development. These first views are limited to current active Group Administrators.</p>
  </>;
}
