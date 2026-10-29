
import {useAdminI18n} from '../../../../lib/admin/i18n';
import Link from "next/link";
import { capitalDealsEnabled } from "../../../../lib/security/capital-deals";

export default function CapitalHome() {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  return <><p className="mzsEyebrow">{adminT("MZS CAPITAL / MANAGEMENT")}</p><h1>{adminT("Investment Cockpit")}</h1>
    <p className="mzsIntro">{adminT("Private financing requests, managed with Capital-specific permissions and audited status updates.")}</p>
    <section className="mzsCards">
      <Link href="/admin/intro-calls"><small>{adminT("PUBLIC ENQUIRIES / FULL ADMINISTRATORS")}</small><h2>{adminT("Introductory Calls")}</h2><p>{adminT("First conversations requested without an account. Arrange a time and track follow-up.")}</p><span>{adminT("Open introductory calls →")}</span></Link>
      {capitalDealsEnabled() && <Link href="/admin/group/capital/deals"><small>{adminT("PRIVATE DEALS / FULL ADMINISTRATORS")}</small><h2>{adminT("Loans & Agreements")}</h2><p>{adminT("Loans provided and received, private agreements, payment schedules and confirmed cash flows.")}</p><span>{adminT("Open private dossiers →")}</span></Link>}
      <Link href="/admin/capital-requests"><small>{adminT("SCOPED WORKFLOW / STAGING")}</small><h2>{adminT("Capital Requests")}</h2>
        <p>{adminT("Review Request Capital and Request Possibilities enquiries without accessing MZS Estates administration.")}</p><span>{adminT("Open Capital Requests →")}</span></Link>
      <div className="mzsPlanned"><small>{adminT("COMING IN PHASE 3")}</small><h2>{adminT("Investment Opportunities")}</h2>
        <p>{adminT("Future dossiers for real estate, corporate finance, private debt, equity and external investment opportunities.")}</p>
        <span>{adminT("Under development")}</span></div>
    </section>
    <p className="mzsFootnote">{adminT("Access is limited to active Group Administrators or explicitly authorised Capital Administrators. Department-level access remains in Preview testing.")}</p>
  </>;
}
