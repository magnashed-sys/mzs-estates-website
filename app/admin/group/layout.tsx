import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import "./group.css";

export default async function GroupLayout({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Phase 3A preview is isolated: never read live customer data from branch previews.
  const staging = "https://senonkpxdtlhyhrubicg.supabase.co";
  const isPreview = process.env.VERCEL_ENV === "preview";
  if (isPreview && url !== staging) {
    return <main className="mzsGroup"><h1>Preview isolation required</h1><p>This Preview must use MZS Staging.</p></main>;
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return <main className="mzsGroup"><h1>Private access required</h1><Link href="/login">Sign in</Link></main>;
  const { data: profile, error } = await supabase.from("profiles")
    .select("role,is_active").eq("id",user.id).single();
  // Existing active Group administrators only. Scoped department accounts will
  // receive separate, audited entry points after end-to-end RLS tests.
  if (error || profile?.role !== "admin" || profile?.is_active !== true)
    return <main className="mzsGroup"><h1>Access restricted</h1><p>Active Group Administrator access is required.</p></main>;
  return <main className="mzsGroup"><header><Link href="/admin">MZS GROUP</Link><span>PRIVATE ADMINISTRATION</span></header>{children}</main>;
}
