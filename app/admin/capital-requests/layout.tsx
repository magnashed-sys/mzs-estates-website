import WorkspaceNavigation from "../workspaces/WorkspaceNavigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { isPhase3aPreviewIsolated } from "../../../lib/security/phase3a-preview-isolation";

export const dynamic = "force-dynamic";

// This server-side gate is defence in depth. The Capital read and write RPCs
// still enforce authorisation on every request, including mid-session revocation.
export default async function CapitalRequestsLayout({
  children
}: { children: React.ReactNode }) {
  // Check isolation before reading cookies or creating any DB client.
  if (!isPhase3aPreviewIsolated()) {
    return <main style={{ padding: "4rem 2rem", minHeight: "100vh" }}>
      <h1>Preview isolation required</h1>
      <p>This Preview must use the isolated MZS Staging database.</p>
    </main>;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return <main style={{ padding: "4rem 2rem", minHeight: "100vh" }}>
      <h1>Private access required</h1>
      <Link href="/login">Sign in</Link>
    </main>;
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role,is_active").eq("id", user.id).single();
  if (profileError || profile?.is_active !== true) {
    return <main style={{ padding: "4rem 2rem", minHeight: "100vh" }}>
      <h1>Access restricted</h1>
      <p>An active administration account is required.</p>
    </main>;
  }

  if (profile.role !== "admin") {
    const { data: hasCapitalScope, error: scopeError } = await supabase.rpc(
      "mzs_has_department_scope", { p_department: "capital" }
    );
    if (scopeError || hasCapitalScope !== true) {
      return <main style={{ padding: "4rem 2rem", minHeight: "100vh" }}>
        <h1>Access restricted</h1>
        <p>Capital Administrator access is required.</p>
      </main>;
    }
  }

  return <>{profile.role==="admin"&&<WorkspaceNavigation/>}{children}</>;
}
