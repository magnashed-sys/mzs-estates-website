import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { isPhase3aPreviewIsolated } from "../../../lib/security/phase3a-preview-isolation";
import "./group.css";

export default async function GroupLayout({ children }: { children: React.ReactNode }) {
  if (!isPhase3aPreviewIsolated()) {
    return <main className="mzsGroup"><h1>Preview isolation required</h1><p>This Preview must use MZS Staging.</p></main>;
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return <main className="mzsGroup"><h1>Private access required</h1><Link href="/login">Sign in</Link></main>;
  const { data: profile, error } = await supabase.from("profiles")
    .select("role,is_active").eq("id", user.id).single();
  if (error || profile?.is_active !== true) {
    return <main className="mzsGroup"><h1>Access restricted</h1><p>An active administration account is required.</p></main>;
  }
  const groupAdmin = profile.role === "admin";
  let capitalAdmin = false;
  if (!groupAdmin) {
    const { data, error: scopeError } = await supabase.rpc("mzs_has_department_scope", {
      p_department: "capital"
    });
    capitalAdmin = !scopeError && data === true;
  }
  if (!groupAdmin && !capitalAdmin) {
    return <main className="mzsGroup"><h1>Access restricted</h1><p>Authorised MZS Group or Capital administration access is required.</p></main>;
  }
  // Group/Estates pages carry their own Group-only guards below this layout.
  // A Capital operator never inherits legacy Group or Estates permissions.
  return <main className="mzsGroup">
    <header>
      <Link href={groupAdmin ? "/admin" : "/admin/group/capital"}>MZS GROUP</Link>
      <span>{groupAdmin ? "PRIVATE GROUP ADMINISTRATION" : "SCOPED CAPITAL ADMINISTRATION"}</span>
    </header>
    {children}
  </main>;
}
