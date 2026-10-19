"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Result = { name: string; passed: boolean; detail: string };
// An invalid request identifier cannot update a real request.
const missingRequest = "00000000-0000-0000-0000-000000000000";

export default function ApiCheck() {
  const [busy,setBusy] = useState(false);
  const [results,setResults] = useState<Result[]>([]);
  const [notice,setNotice] = useState("");
  async function run() {
    if (busy) return;
    setBusy(true); setResults([]); setNotice("");
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://senonkpxdtlhyhrubicg.supabase.co") throw new Error("Staging required.");
      const client = createClient();
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user || user.app_metadata?.mzs_phase3a_test !== true ||
          !/^phase3a-test-.*@example\.invalid$/.test(user.email ?? "")) throw new Error("Sign in with a trusted Phase 3A test account.");
      const { data: profile, error: profileError } = await client.from("profiles").select("role,is_active").eq("id",user.id).single();
      const { data: scope,error: scopeError } = await client.rpc("mzs_has_department_scope",{p_department:"capital"});
      if (profileError || !profile?.is_active || !["client","partner"].includes(profile.role) || scopeError || scope !== false) {
        throw new Error("This check requires an active client test account without Capital rights.");
      }
      const checks: Result[] = [];
      const read = await client.rpc("mzs_capital_admin_list_requests");
      checks.push({name:"Direct Capital read denied",passed:read.error?.code === "42501",detail:read.error?.code ?? "Unexpected response"});
      const write = await client.rpc("mzs_capital_admin_update_request",{p_request_id:missingRequest,p_new_status:"contacted"});
      checks.push({name:"Direct Capital update denied",passed:write.error?.code === "42501",detail:write.error?.code ?? "Unexpected response"});
      // Null target is always invalid, including if authorization unexpectedly fails open.
      const grant = await client.rpc("mzs_set_admin_department_scope",{p_target_user:null,p_department:"capital",p_enabled:false});
      checks.push({name:"Direct scope management denied",passed:grant.error?.message === "Unauthorized",detail:grant.error?.message === "Unauthorized" ? "Unauthorized" : "Unexpected response"});
      const response = await fetch("/api/capital-requests/admin",{
        method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:missingRequest,status:"contacted"})
      });
      const body = await response.json().catch(()=>null);
      checks.push({name:"Website PATCH denied",passed:response.status === 403 && body?.error === "Capital administration access required",detail:`HTTP ${response.status}`});
      const sessionAfter = await client.auth.getUser();
      checks.push({name:"Authenticated session remains valid",passed:!sessionAfter.error && sessionAfter.data.user?.id === user.id,detail:sessionAfter.data.user?.id === user.id ? "Verified" : "Not verified"});
      setResults(checks);
      setNotice(checks.every(c=>c.passed) ? "All 5 checks passed." : "Not all checks passed. Share these results for review.");
    } catch {
      setNotice("Check could not complete. Use the active Phase 3A client test account without Capital rights and try again.");
    } finally { setBusy(false); }
  }
  return <main style={{maxWidth:850,margin:"60px auto",padding:24}}>
    <h1>Staging API access check</h1>
    <p>Use the Phase 3A client test account without Capital rights. This check does not send email or modify a valid request.</p>
    <button disabled={busy} onClick={()=>void run()}>{busy ? "Checking…" : "Run access checks"}</button>
    <p role="status">{notice}</p>
    <ul>{results.map(r=><li key={r.name}>{r.passed ? "PASS" : "FAIL"} — {r.name}: {r.detail}</li>)}</ul>
    <a href="/private">Back to private collection</a>
  </main>;
}
