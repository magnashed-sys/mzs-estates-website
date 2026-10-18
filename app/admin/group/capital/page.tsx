import Link from "next/link";

export default function CapitalHome() {
  return <><p className="mzsEyebrow">MZS CAPITAL / MANAGEMENT</p><h1>Investment Cockpit</h1>
    <p className="mzsIntro">Private financing requests, managed with Capital-specific permissions and audited status updates.</p>
    <section className="mzsCards">
      <Link href="/admin/capital-requests"><small>SCOPED WORKFLOW / STAGING</small><h2>Capital Requests</h2>
        <p>Review Request Capital and Request Possibilities enquiries without accessing MZS Estates administration.</p><span>Open Capital Requests →</span></Link>
      <div className="mzsPlanned"><small>COMING IN PHASE 3</small><h2>Investment Opportunities</h2>
        <p>Future dossiers for real estate, corporate finance, private debt, equity and external investment opportunities.</p>
        <span>Under development</span></div>
    </section>
    <p className="mzsFootnote">Access is limited to active Group Administrators or explicitly authorised Capital Administrators. Department-level access remains in Preview testing.</p>
  </>;
}
