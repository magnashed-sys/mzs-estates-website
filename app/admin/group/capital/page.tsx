import Link from "next/link";
export default function CapitalHome() {
 return <><p className="mzsEyebrow">MZS CAPITAL / MANAGEMENT</p><h1>Investment Cockpit</h1>
 <p className="mzsIntro">Private financing requests today, with a separate investment-opportunities pipeline to follow.</p>
 <section className="mzsCards"><Link href="/admin/capital-requests"><small>LIVE WORKFLOW</small><h2>Capital Requests</h2><p>Review existing Request Capital and Request Possibilities enquiries without duplicating data.</p><span>Open Capital Requests →</span></Link>
 <div className="mzsPlanned"><small>COMING IN PHASE 3</small><h2>Investment Opportunities</h2><p>Future dossiers for real estate, corporate finance, private debt, equity and external investment opportunities.</p><span>Under development</span></div></section>
 <p className="mzsFootnote">Existing Capital Requests administration is unchanged and still requires the current active global administrator role.</p><Link href="/admin/group">← Group overview</Link></>;
}
