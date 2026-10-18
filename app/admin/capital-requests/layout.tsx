import { isPhase3aPreviewIsolated } from "../../../lib/security/phase3a-preview-isolation";

// The Capital Requests page is a client component. The server-side layout
// prevents it from even rendering if this Preview targets a non-Staging DB.
// The database functions separately enforce authentication and department RLS.
export default function CapitalRequestsLayout({ children }: { children: React.ReactNode }) {
  if (!isPhase3aPreviewIsolated()) {
    return <main style={{ padding: "4rem 2rem", minHeight: "100vh" }}>
      <h1>Preview isolation required</h1>
      <p>This Preview must use the isolated MZS Staging database.</p>
    </main>;
  }
  return <>{children}</>;
}
