import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";

export default async function GroupHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p>Group Administrator access required.</p>;
  const { data: profile } = await supabase.from("profiles")
    .select("role,is_active").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile.is_active !== true) {
    return <p>Group Administrator access required.</p>;
  }
  return <><p className="mzsEyebrow">GROUP ADMINISTRATION / PHASE 3A</p>
    <h1>Two specialist platforms. One private group.</h1>
    <p className="mzsIntro">Select a business division. Your private customer permissions remain unchanged.</p>
    <section className="mzsCards" aria-label="Business divisions">
      <Link href="/admin/group/estates"><small>01 / REAL ESTATE</small><h2>MZS Estates</h2>
        <p>Properties, private rentals, sales and development projects.</p><span>Enter Estates →</span></Link>
      <Link href="/admin/group/capital"><small>02 / PRIVATE CAPITAL</small><h2>MZS Capital</h2>
        <p>Own and external investments, financing and private capital enquiries.</p><span>Enter Capital →</span></Link>
    </section>
    {process.env.VERCEL_ENV === "preview" && <p className="mzsFootnote">
      STAGING ONLY · <Link href="/admin/group/capital-access">Capital access pilot →</Link>
      {" "}Grant and revoke Capital rights for synthetic test accounts.
    </p>}
    <p className="mzsFootnote">Group Administration is restricted to existing active Group Administrators.</p>
  </>;
}
