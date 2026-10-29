"use client";
import {useAdminI18n} from '../../lib/admin/i18n';
import AdminMessage from './AdminMessage';

import WorkspaceNavigation from "./workspaces/WorkspaceNavigation";
import ArrowUpRightIcon from "../components/ArrowUpRightIcon";

import "./admin.css";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import dynamic from "next/dynamic";
import type { PlannedInvitation } from "./RequestProjectApproval";
// Defer specialist modules until the corresponding administration panel is rendered.
const RequestProjectApproval = dynamic(() => import("./RequestProjectApproval"), {loading:()=> <p role="status" className="admin-help"><AdminMessage text="Loading approval form…"/></p>});
import { assertComplete, matchesRequestFilter, matchesSearch, requestStage, type RequestFilter } from "./admin-model";

type AccessRequest = { id: string; full_name: string; email: string; company: string | null; country: string | null; interests: string[]; message: string | null; status: string; created_at: string; auth_user_id: string | null; email_verified_at: string | null };
type Relationship = { id: string; full_name: string | null; email: string; role: "client" | "partner"; is_active: boolean; created_at: string };
type CompanyAssociation = { id: string; user_id: string; legal_name: string; trading_name: string | null; registration_number: string | null; country: string | null; relationship_type: string };
type ContactSnapshot = { user_id: string; phone: string | null; city: string | null; country: string | null };
type Project = { id: string; title: string; location: string | null; status: string };
type Offering = { id: string; project_id: string; title: string; offering_type: string; status: string };
type Tab = "relationships" | "companies" | "projects" | "analytics";
type PageState = "loading" | "ready" | "denied" | "error";
const labels: Record<string, string> = { investment: "Investment", financing: "Private Capital", rental: "Private Rental", sale: "Private Sale" };
const routes:Record<Tab,string>={relationships:"/admin/accounts",companies:"/admin/member-companies",projects:"/admin/projects",analytics:"/admin/system"};
const requestFilters: [RequestFilter, string][] = [["pending", "Pending"], ["approved", "Approved"], ["invitations", "Invitations"], ["declined", "Declined"], ["all", "All"]];
const pageSize = 12;
const trafficReport = "https://vercel.com/mzs3/mzs-group/analytics";
function date(value: string, adminLocale = 'en-GB') { return new Date(value).toLocaleDateString(adminLocale, { timeZone: "Europe/Madrid" }); }

export default function AdminPanels({section,initialFilter="pending"}:{section:Tab;initialFilter?:RequestFilter}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [invitations, setInvitations] = useState<PlannedInvitation[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [memberCompanies, setMemberCompanies] = useState<CompanyAssociation[]>([]);
  const [memberContacts, setMemberContacts] = useState<ContactSnapshot[]>([]);
  const [directoryState,setDirectoryState] = useState<"idle"|"loading"|"ready"|"error">("idle");
  const [directoryVersion,setDirectoryVersion] = useState(-1);
  const [offeringsState,setOfferingsState] = useState<"idle"|"loading"|"ready"|"error">("idle");
  const [offeringsVersion,setOfferingsVersion] = useState(-1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const bookingBusy=false;
  const [refreshVersion, setRefreshVersion] = useState(0);
  const tab=section;
  const [relationshipView, setRelationshipView] = useState<"requests" | "accounts">("requests");
  const [filter, setFilter] = useState<RequestFilter>(initialFilter);
  const [search, setSearch] = useState("");
  const [accountRole, setAccountRole] = useState("all");
  const [accountStatus, setAccountStatus] = useState("all");
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean; connectionVerified: boolean; missing: string[];
  } | null>(null);
  const [smtpChecking, setSmtpChecking] = useState(false);
  const [smtpCheckError, setSmtpCheckError] = useState("");
  const [smtpTestSending, setSmtpTestSending] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState("");
  const [smtpTestError, setSmtpTestError] = useState("");
  const [stagingPreview, setStagingPreview] = useState(false);
  const [activationRetrying, setActivationRetrying] = useState(false);
  const [activationRetryResult, setActivationRetryResult] = useState("");
  const [activationRetryError, setActivationRetryError] = useState("");
  const [projectMailRetrying, setProjectMailRetrying] = useState(false);
  const [projectMailRetryResult, setProjectMailRetryResult] = useState("");
  const [projectMailRetryError, setProjectMailRetryError] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const actionLock = useRef(false);

  const reload = useCallback(async () => {
    const version = ++generation.current;
    const current = () => mounted.current && version === generation.current;
    setRefreshing(true); setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      // Reload the public locale provider when leaving the English admin shell.
      if (authError || !auth.user) { window.location.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
      if (!current()) return;
      if (profileError || profile?.role !== "admin" || profile.is_active !== true) { setState("denied"); return; }
      // Keep the preview administration usable while the new database
      // columns are still under migration review. Production is not modified.
      async function loadRequestRecords() {
        const next = await supabase.from("access_requests")
          .select("id,full_name,email,company,country,interests,message,status,created_at,auth_user_id,email_verified_at",
            { count: "exact" }).order("created_at", { ascending: false });
        if (!next.error || next.error.code !== "42703") return next;
        const legacy = await supabase.from("access_requests")
          .select("id,full_name,email,company,country,interests,message,status,created_at",
            { count: "exact" }).order("created_at", { ascending: false });
        return {
          ...legacy,
          data: legacy.data?.map(request => ({
            ...request, auth_user_id: null, email_verified_at: null,
          })) ?? null,
        };
      }

      const empty=()=>Promise.resolve({data:[],error:null,count:0});
      const results = await Promise.all([
        section==="relationships"?loadRequestRecords():empty(),
        section==="relationships"?supabase.from("access_invitations").select("id,request_id,email,requested_role,status,invited_at", { count: "exact" }).order("invited_at", { ascending: false }):empty(),
        (section==="relationships"||section==="companies")?supabase.from("profiles").select("id,full_name,email,role,is_active,created_at", { count: "exact" }).in("role", ["client", "partner"]).order("created_at", { ascending: false }):empty(),
        (section==="relationships"||section==="projects")?supabase.from("projects").select("id,title,location,status", { count: "exact" }).order("title"):empty(),
      ]);
      if (!current()) return;
      assertComplete(results);
      setRequests((results[0].data ?? []) as AccessRequest[]);
      setInvitations((results[1].data ?? []) as PlannedInvitation[]);
      setRelationships((results[2].data ?? []) as Relationship[]);
      setProjects((results[3].data ?? []) as Project[]);
      // Company affiliations, contact details and offering descriptions are
      // fetched on demand when their specialist tab is actually opened.
      setUpdated(new Date().toLocaleTimeString(adminLocale, { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }));
      setState("ready");
      setRefreshVersion(value => value + 1);
    } catch (cause) {
      if (current()) { setError(cause instanceof Error ? cause.message : "Unable to load administration."); setState("error"); }
    } finally { if (current()) setRefreshing(false); }
  }, [section]);

  useEffect(() => {
    mounted.current = true;
    setStagingPreview(
      window.location.hostname.startsWith("mzs-group-") &&
      window.location.hostname.endsWith("-mzs3.vercel.app")
    );
    void reload();
    return () => { mounted.current = false; generation.current += 1; };
  }, [reload]);

  // Defer relationship detail queries until Accounts or Companies is opened.
  // Verification and RLS remain in Supabase; a failed optional query is not
  // displayed as an empty register or allowed to replace previously loaded data.
  useEffect(()=>{
    if(state!=="ready" || !(
      tab==="companies" || (tab==="relationships" && relationshipView==="accounts")
    ) || directoryVersion===refreshVersion) return;
    let active=true;
    setDirectoryState("loading");
    void (async()=>{
      try{
        const db=createClient();
        const [companies,contacts]=await Promise.all([
          db.from("mzs_member_companies")
            .select("id,user_id,legal_name,trading_name,registration_number,country,relationship_type",{count:"exact"})
            .order("legal_name"),
          db.from("mzs_member_contact_details")
            .select("user_id,phone,city,country",{count:"exact"})
        ]);
        assertComplete([companies,contacts]);
        if(!active)return;
        setMemberCompanies((companies.data??[]) as CompanyAssociation[]);
        setMemberContacts((contacts.data??[]) as ContactSnapshot[]);
        setDirectoryState("ready");
      } catch {
        if(active)setDirectoryState("error");
      } finally {
        if(active)setDirectoryVersion(refreshVersion);
      }
    })();
    return ()=>{active=false};
  },[state,tab,relationshipView,refreshVersion,directoryVersion]);

  useEffect(()=>{
    if(state!=="ready" || tab!=="projects" || offeringsVersion===refreshVersion)return;
    let active=true;
    setOfferingsState("loading");
    void (async()=>{
      try{
        const db=createClient();
        const result=await db.from("offerings")
          .select("id,project_id,title,offering_type,status",{count:"exact"})
          .order("title");
        assertComplete([result]);
        if(!active)return;
        setOfferings((result.data??[]) as Offering[]);
        setOfferingsState("ready");
      } catch {
        if(active)setOfferingsState("error");
      } finally {
        if(active)setOfferingsVersion(refreshVersion);
      }
    })();
    return ()=>{active=false};
  },[state,tab,refreshVersion,offeringsVersion]);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const locked = Boolean(busy || bookingBusy || reviewing || refreshing);
  function guardLink(event: MouseEvent<HTMLAnchorElement>) { if (locked || actionLock.current) event.preventDefault(); }
  const invitationMap = new Map(invitations.map(item => [item.request_id, item]));
  const pending = requests.filter(item => matchesRequestFilter(item.status, invitationMap.get(item.id), "pending"));
  const approved = requests.filter(item => matchesRequestFilter(item.status, invitationMap.get(item.id), "approved"));
  const attentionInvites = invitations.filter(item => !["sent", "completed"].includes(item.status));
  const activeCount = relationships.filter(item => item.is_active).length;
  const visibleRequests = requests.filter(item => item.id === reviewing || (matchesRequestFilter(item.status, invitationMap.get(item.id), filter)
    && matchesSearch(search, item.full_name, item.email, item.company, item.country)));
  const companiesFor = (userId: string) => memberCompanies.filter(company => company.user_id === userId);
  const contactFor = (userId: string) => memberContacts.find(contact => contact.user_id === userId);
  const visibleAccounts = relationships.filter(item => {
    const contact = contactFor(item.id);
    const companies = companiesFor(item.id);
    return matchesSearch(search, item.full_name, item.email, contact?.phone, contact?.city,
      contact?.country, ...companies.flatMap(company => [
        company.legal_name, company.trading_name, company.registration_number,
        company.country, company.relationship_type,
      ])) && (accountRole === "all" || accountRole === item.role)
      && (accountStatus === "all" || item.is_active === (accountStatus === "active"));
  });
  const visibleCompanies = memberCompanies.filter(company => {
    const linked = relationships.find(account => account.id === company.user_id);
    return matchesSearch(search, company.legal_name, company.trading_name,
      company.registration_number, company.country, company.relationship_type,
      linked?.full_name, linked?.email);
  });
  const visibleProjects = projects.filter(item => matchesSearch(search, item.title, item.location));

  async function checkSmtpConnection() {
    if (smtpChecking) return;
    setSmtpChecking(true);
    setSmtpStatus(null);
    setSmtpCheckError("");
    try {
      const response = await fetch("/api/account/notifications/status", {
        method: "GET",
        cache: "no-store",
      });
      const result: {
        configured?: boolean; connectionVerified?: boolean;
        missing?: string[]; error?: string;
      } = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to verify SMTP settings");
      }
      setSmtpStatus({
        configured: result.configured === true,
        connectionVerified: result.connectionVerified === true,
        missing: Array.isArray(result.missing) ? result.missing : [],
      });
    } catch {
      setSmtpCheckError("Unable to check the mail server. Please try again later.");
    } finally {
      setSmtpChecking(false);
    }
  }

  async function sendSmtpTest() {
    if (smtpTestSending || smtpChecking || !smtpStatus?.connectionVerified) return;
    if (!window.confirm(
      adminT("Send one MZS Group test notification to your own administrator email address?\\n\\nNo clients, partners or project permissions will be affected.")
    )) return;
    setSmtpTestSending(true);
    setSmtpTestResult("");
    setSmtpTestError("");
    try {
      const response = await fetch("/api/account/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: "{}",
      });
      const payload: { accepted?: boolean; message?: string; error?: string } =
        await response.json();
      if (!response.ok || !payload.accepted) {
        throw new Error(payload.error || "The SMTP server did not accept the test.");
      }
      setSmtpTestResult(
        "The SMTP server accepted the test email. Please check your administrator inbox and spam folder to confirm it arrived."
      );
    } catch {
      setSmtpTestError(
        "The test email was not confirmed as accepted. Check the server logs before trying again."
      );
    } finally {
      setSmtpTestSending(false);
    }
  }

  async function retryStagingActivationMail() {
    if (activationRetrying || locked) return;
    if (!window.confirm(
      adminT("Send the pending activation email to the already approved test client in MZS Staging?\\n\\nNo account status, projects or permissions will change.")
    )) return;
    setActivationRetrying(true);
    setActivationRetryError("");
    setActivationRetryResult("");
    try {
      const response = await fetch("/api/account/notifications/retry-staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: "{}",
      });
      const result: { status?: string; error?: string; note?: string } =
        await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Staging activation email retry not confirmed.");
      }
      if (result.status === "sent") {
        setActivationRetryResult(
          "The activation email has been accepted by the mail server. Check the test client's inbox or spam folder."
        );
      } else if (result.status === "none") {
        setActivationRetryResult(
          "There are no pending activation emails available for retry."
        );
      } else {
        setActivationRetryError(
          "The activation email is not confirmed as sent. Please check the mail queue before trying again."
        );
      }
    } catch {
      setActivationRetryError(
        "Unable to confirm delivery. Do not retry repeatedly; review the staging queue first."
      );
    } finally {
      setActivationRetrying(false);
    }
  }

  async function retryStagingProjectNotifications() {
    if (projectMailRetrying || locked) return;
    if (!window.confirm(
      adminT("Send the existing pending project-access notifications in MZS Staging?\\n\\nThis does not add, remove or modify project access.")
    )) return;
    setProjectMailRetrying(true);
    setProjectMailRetryResult("");
    setProjectMailRetryError("");
    try {
      const response = await fetch("/api/account/notifications/retry-project-staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: "{}",
      });
      const outcome: {
        status?: string;
        emailsAccepted?: number;
        error?: string;
      } = await response.json();
      if (!response.ok) {
        throw new Error(outcome.error || "Project-email delivery could not be confirmed.");
      }
      if (outcome.status === "none") {
        setProjectMailRetryResult("No pending project notifications need delivery.");
      } else if (outcome.status === "sent") {
        setProjectMailRetryResult(
          String(outcome.emailsAccepted ?? 0) +
          " project notification(s) accepted by the mail server. Check the test client's inbox."
        );
      } else {
        setProjectMailRetryError(
          "Some emails still require review. Check the staging notification queue before retrying."
        );
      }
    } catch {
      setProjectMailRetryError(
        "The project notification attempt is unconfirmed. Check the staging queue before retrying."
      );
    } finally {
      setProjectMailRetrying(false);
    }
  }

  function navigate(next:Tab){
    if(locked||actionLock.current||next===tab)return;
    router.push(routes[next]);
  }

  function openRequests(next:RequestFilter){
    if(locked||actionLock.current)return;
    if(tab!=="relationships"){router.push("/admin/accounts?filter="+next);return;}
    setRelationshipView("requests");setFilter(next);
  }
  async function runAction(key: string, action: () => Promise<string>) {
    if (actionLock.current || locked) return;
    actionLock.current = true; setBusy(key); setNotice("");
    try { const text = await action(); if (mounted.current) setNotice(text); }
    catch { if (mounted.current) { setError("The result could not be confirmed. Reload to verify the recorded status before another action."); setState("error"); } }
    finally { actionLock.current = false; if (mounted.current) setBusy(null); }
  }
  function decline(request: AccessRequest) {
    if (request.status !== "pending" || invitationMap.has(request.id) || locked) return;
    if (!window.confirm(adminT("Decline the request from {p0} ({p1})?", {p0: request.full_name, p1: request.email}))) return;
    void runAction(request.id, async () => {
      const { data, error: failure } = await createClient().rpc("review_access_request", { p_request_id: request.id, p_decision: "declined" });
      if (failure || data !== true) throw new Error("Review not confirmed");
      await reload(); return "Request declined.";
    });
  }
  function changeAccount(account: Relationship) {
    const activate = !account.is_active;
    if (locked || !window.confirm(adminT("{p0} {p1}? {p2}", {p0: adminT(activate ? "Activate" : "Deactivate"), p1: account.email, p2: adminT(activate ? "Existing assigned projects become accessible again." : "Private access will be blocked.")}))) return;
    void runAction(account.id, async () => {
      const supabase = createClient();
      const { data, error: failure } = await supabase.rpc("set_relationship_active", { p_user_id: account.id, p_active: activate });
      if (failure || data !== true) throw new Error("Update not confirmed");
      const { data: verified, error: verifyError } = await supabase.from("profiles").select("is_active").eq("id", account.id).single();
      if (verifyError || verified?.is_active !== activate) throw new Error("Verification failed");
      if (mounted.current) setRelationships(items => items.map(item => item.id === account.id ? { ...item, is_active: activate } : item));
      return `${account.email} is now ${activate ? "active" : "inactive"}.`;
    });
  }
  function recordInvitation(invitation: PlannedInvitation) {
    setInvitations(items => [invitation, ...items.filter(item => item.request_id !== invitation.request_id)]);
    // The review panel reports the verified outcome, including assigned access.
  }
  async function signOut() {
    if (locked || actionLock.current) return;
    actionLock.current = true; setBusy("signout");
    try {
      const { error: failure } = await createClient().auth.signOut();
      if (failure) throw failure;
      router.replace("/"); router.refresh();
    } catch { setNotice("Unable to sign out. Please try again."); }
    finally { actionLock.current = false; if (mounted.current) setBusy(null); }
  }

  if (state !== "ready") return <main className="admin-page"><div className="admin-message">
    <p className="eyebrow">{adminT("MZS Administration")}</p>
    <h1>{state === "loading" ? adminT("Preparing your workspace.") : state === "denied" ? adminT("Access restricted.") : adminT("Unable to load.")}</h1>
    <p role={state === "error" ? "alert" : "status"}>{state === "loading" ? adminT("Verifying administrator access…") : state === "denied" ? adminT("Active administrator access is required.") : adminT(error)}</p>
    {state === "error" && <button className="admin-button" disabled={refreshing} onClick={() => void reload()}>{adminT("Try again")}</button>}
    <a href="/login">{adminT("Return to login →")}</a>
  </div></main>;

  return <main className="admin-page">
    <header className="admin-header"><Link href="/admin/workspaces/group" onClick={guardLink} className="admin-brand">{adminT("MZS GROUP")}</Link><div className="admin-header-actions"><span>{adminT("Private administration")}</span><Link href="/admin/workspaces/group" onClick={guardLink} aria-disabled={locked} className="admin-button">{adminT("Administration →")}</Link><button disabled={locked} onClick={() => void signOut()}>{busy === "signout" ? adminT("Signing out…") : adminT("Sign out")}</button></div></header>
    <section className="admin-content">
      <div className="admin-heading-row"><div><p className="eyebrow">{adminT("MZS Administration")}</p><h1>{section==="relationships"?adminT("Accounts & requests."):section==="companies"?adminT("Member companies."):section==="projects"?adminT("Projects & access."):adminT("System.")}</h1></div><div className="admin-refresh"><button className="admin-button" disabled={locked} onClick={() => void reload()}>{refreshing ? adminT("Refreshing…") : adminT("Refresh dashboard")}</button><small>{updated ? adminT("Dashboard updated {p0} · Madrid time", {p0: updated}) : ""}</small></div></div>
      <WorkspaceNavigation disabled={locked}/>
      {reviewing && <p className="admin-help">{adminT("Close the open review to switch sections, change filters or refresh the dashboard.")}</p>}
      {notice && <p className="admin-notice" role="status">{adminT(notice)}</p>}
      {tab === "relationships" && <>
        <div className="admin-actions admin-space-top"><Link className="admin-button admin-button-primary" onClick={guardLink} href="/admin/relationships?new=person">{adminT("New client")}</Link><Link className="admin-button" onClick={guardLink} href="/admin/relationships?new=company">{adminT("New company")}</Link><Link className="admin-button" onClick={guardLink} href="/admin/relationships">{adminT("Open central relationship register →")}</Link></div>
        <div className="admin-panel" style={{ marginBottom: 28 }}>
          <h3 className="admin-subtitle">{adminT("Account notification email")}</h3>
          <p className="admin-help">
            {adminT("Check whether MZS Group can connect securely to the existing invitation mailbox. No passwords or email account details are shown.")}</p>
          <button className="admin-button" type="button"
            disabled={smtpChecking || locked}
            onClick={() => void checkSmtpConnection()}>
            {smtpChecking ? adminT("Checking connection...") : adminT("Verify SMTP connection")}
          </button>
          {smtpStatus && (
            <p role="status" className="admin-help">
              {smtpStatus.connectionVerified
                ? adminT("SMTP login and secure connection verified. A real delivery test is still required before release.")
                : smtpStatus.configured
                  ? adminT("SMTP settings detected but the connection test failed. Check credentials, network and server policy in Vercel.")
                  : adminT("Mail server settings are incomplete: {p0}", {p0: smtpStatus.missing.join(", ")})}
            </p>
          )}
          {smtpStatus?.connectionVerified && (
            <div style={{ marginTop: 18 }}>
              <p className="admin-help">
                {adminT("The next check sends one real message only to your own administrator mailbox. It does not register or contact customers.")}</p>
              <button type="button" className="admin-button"
                disabled={smtpTestSending || smtpChecking || locked}
                onClick={() => void sendSmtpTest()}>
                {smtpTestSending ? adminT("Sending test email...") : adminT("Send test email to my address →")}
              </button>
            </div>
          )}
          {smtpTestResult && <p className="admin-help" role="status">{adminT(smtpTestResult)}</p>}
          {smtpTestError && <p className="admin-notice" role="alert">{adminT(smtpTestError)}</p>}
          {smtpCheckError && <p className="admin-notice" role="alert">{adminT(smtpCheckError)}</p>}
          {stagingPreview && (
            <div style={{ borderTop: "1px solid #514839", marginTop: 26, paddingTop: 18 }}>
              <h4 className="admin-subtitle">{adminT("Staging — Activation email")}</h4>
              <p className="admin-help">
                {adminT("One approved test account has an activation email in the queue. Retry only the existing message; no account or project permissions change.")}</p>
              <button type="button" className="admin-button"
                disabled={activationRetrying || locked}
                onClick={() => void retryStagingActivationMail()}>
                {activationRetrying
                  ? adminT("Checking queued activation email...")
                  : adminT("Send pending activation email →")}
              </button>
              {activationRetryResult && (
                <p className="admin-help" role="status">{adminT(activationRetryResult)}</p>
              )}
              {activationRetryError && (
                <p className="admin-notice" role="alert">{adminT(activationRetryError)}</p>
              )}
              <div style={{ borderTop: "1px solid #514839", marginTop: 20, paddingTop: 18 }}>
                <h4 className="admin-subtitle">{adminT("Staging — Project notifications")}</h4>
                <p className="admin-help">
                  {adminT("Send already queued notifications about newly granted test project access. Account approvals and project permissions will not be changed.")}</p>
                <button type="button" className="admin-button"
                  disabled={projectMailRetrying || locked}
                  onClick={() => void retryStagingProjectNotifications()}>
                  {projectMailRetrying
                    ? adminT("Sending queued project emails...")
                    : adminT("Send pending project emails →")}
                </button>
                {projectMailRetryResult && (
                  <p className="admin-help" role="status">{adminT(projectMailRetryResult)}</p>
                )}
                {projectMailRetryError && (
                  <p className="admin-notice" role="alert">{adminT(projectMailRetryError)}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="admin-section-heading"><div><p className="eyebrow">{adminT("Selected relationships")}</p><h2>{adminT("People & access.")}</h2></div></div>
        <div className="admin-toolbar"><div className="admin-filters">{(["requests", "accounts"] as const).map(view => <button key={view} disabled={locked} aria-pressed={relationshipView === view} onClick={() => { setRelationshipView(view); setLimit(pageSize); setSearch(""); }}>{view === "requests" ? adminT("Requests & invitations") : adminT("Accounts")}</button>)}</div><label className="admin-field">{adminT("Search relationships")}<input type="search" value={search} disabled={locked} placeholder={adminT("Name, email or company")} onChange={event => { setSearch(event.target.value); setLimit(pageSize); }} /></label></div>
        {relationshipView === "requests" ? <>
          <div className="admin-filters">{requestFilters.map(([key, label]) => <button key={key} disabled={locked} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(pageSize); }}>{adminT(label)} <span>({requests.filter(item => matchesRequestFilter(item.status, invitationMap.get(item.id), key)).length})</span></button>)}</div>
          <p className="admin-help">{visibleRequests.length}  {adminT("matching requests")}</p>
          {!visibleRequests.length && <p className="admin-empty">{adminT("No requests match these filters.")}</p>}
          <div className="admin-requests">{visibleRequests.slice(0, limit).map(request => {
            const invitation = invitationMap.get(request.id);
            const stage = request.auth_user_id
              ? (request.status === "approved" ? "activated" : request.email_verified_at ? "verified_pending" : "awaiting_email_verification")
              : requestStage(request.status, invitation);
            return <article key={request.id} className="admin-request">
              <div className="admin-request-top"><div><h3>{request.full_name}</h3><p>{request.email}</p></div><span className={`admin-status ${stage === "needs_review" ? "admin-status-warning" : ""}`}>{stage.replace(/_/g, " ")}</span></div>
              <div className="admin-request-details">{request.company && <p>{request.company}</p>}{request.country && <p>{request.country}</p>}<p>{adminT("Received")} {date(request.created_at, adminLocale)}</p></div>
              <div className="admin-interests">{(request.interests ?? []).map(interest => <span key={interest}>{adminT(labels[interest] ?? interest)}</span>)}</div>
              {request.message && <p className="admin-request-message">{request.message}</p>}
              {!invitation && (request.auth_user_id ? request.status === "pending" : ["pending", "approved"].includes(request.status)) && <div className="admin-actions admin-space-top"><button className="admin-button admin-button-primary" disabled={locked} onClick={() => setReviewing(request.id)}>{request.auth_user_id ? adminT("Review verified account") : request.status === "pending" ? adminT("Review & select projects") : adminT("Project selection & invitation")}</button>{request.status === "pending" && <button className="admin-button" disabled={locked} onClick={() => decline(request)}>{adminT("Decline")}</button>}</div>}
              {reviewing === request.id && <RequestProjectApproval request={request} onApproved={id => setRequests(items => items.map(item => item.id === id ? { ...item, status: "approved" } : item))} onInvited={recordInvitation} onClose={() => { setReviewing(null); void reload(); }} />}
              {invitation && <p className="admin-help admin-space-top">{stage === "registered" ? adminT("Registration completed. Manage assigned rights in Project Access.") : stage === "invited" ? adminT("Invitation sent. Registration is a separate step.") : adminT("Check the invitation outcome before another attempt.")}</p>}
            </article>;
          })}</div>
          {visibleRequests.length > limit && <button className="admin-button admin-space-top" disabled={locked} onClick={() => setLimit(value => value + pageSize)}>{adminT("Show more requests")}</button>}
        </> : <>
          {directoryState==="loading"&&<p role="status" className="admin-help">{adminT("Loading relationship company and contact details…")}</p>}
          {directoryState==="error"&&<p role="alert" className="admin-notice">{adminT("Relationship details could not be loaded. Refresh the dashboard to retry.")}</p>}
          {directoryState==="ready"&&<>
          <div className="admin-toolbar"><label className="admin-field">{adminT("Account type")}<select disabled={locked} value={accountRole} onChange={event => { setAccountRole(event.target.value); setLimit(pageSize); }}><option value="all">{adminT("All types")}</option><option value="client">{adminT("Client")}</option><option value="partner">{adminT("Partner")}</option></select></label><label className="admin-field">{adminT("Status")}<select disabled={locked} value={accountStatus} onChange={event => { setAccountStatus(event.target.value); setLimit(pageSize); }}><option value="all">{adminT("All statuses")}</option><option value="active">{adminT("Active")}</option><option value="inactive">{adminT("Inactive")}</option></select></label></div>
          <p className="admin-help">{visibleAccounts.length}  {adminT("matching accounts")}</p>
          {!visibleAccounts.length && <p className="admin-empty">{adminT("No accounts match these filters.")}</p>}
          <div className="admin-requests">{visibleAccounts.slice(0, limit).map(account => {
            const contact = contactFor(account.id);
            const declaredCompanies = companiesFor(account.id);
            return <article key={account.id} className="admin-request">
              <div className="admin-request-top"><div><h3>{account.full_name || adminT("Unnamed relationship")}</h3><p>{account.email}</p></div><span className="admin-status">{account.is_active ? adminT("Active") : adminT("Inactive")} · {adminT(account.role)}</span></div>
              <div className="admin-request-details">
                <p>{adminT("Created")} {date(account.created_at, adminLocale)}</p>
                {(contact?.city || contact?.country) && <p>{[contact.city, contact.country].filter(Boolean).join(" · ")}</p>}
                {contact?.phone && <p>{contact.phone}</p>}
              </div>
              {declaredCompanies.length > 0 && <div className="admin-interests">
                {declaredCompanies.map(company => <span key={company.id}>{company.legal_name} · {company.relationship_type.replace(/_/g, " ")}</span>)}
              </div>}
              <div className="admin-actions admin-space-top">
                <Link onClick={guardLink} className="admin-button admin-button-primary" href={"/admin/relationships/" + encodeURIComponent(account.id)}>{adminT("Open relationship dossier →")}</Link>
                <Link onClick={guardLink} className="admin-button" href={"/admin/project-access?user=" + encodeURIComponent(account.id)}>{adminT("Manage project access →")}</Link>
                <button className="admin-button" disabled={locked || (!account.is_active && requests.some(req => req.auth_user_id === account.id && req.status !== "approved"))} onClick={() => changeAccount(account)}>{busy === account.id ? adminT("Processing…") : account.is_active ? adminT("Deactivate") : adminT("Activate")}</button>
              </div>
            </article>;
          })}</div>
          {visibleAccounts.length > limit && <button className="admin-button admin-space-top" disabled={locked} onClick={() => setLimit(value => value + pageSize)}>{adminT("Show more accounts")}</button>}
          </>}
        </>}
      </>}

      {tab === "companies" && <>
        {directoryState==="loading"&&<p role="status" className="admin-help">{adminT("Loading company directory…")}</p>}
        {directoryState==="error"&&<p role="alert" className="admin-notice">{adminT("Company directory could not be loaded. Refresh to retry.")}</p>}
        <div className="admin-actions admin-space-top"><Link className="admin-button admin-button-primary" onClick={guardLink} href="/admin/relationships?new=company">{adminT("New company")}</Link><Link className="admin-button" onClick={guardLink} href="/admin/relationships?kind=company">{adminT("Open company relationships →")}</Link></div>
        <p><Link className="admin-button" onClick={guardLink} href="/admin/group/estates/contracts?view=issuers">{adminT("Manage landlord & issuing entities →")}</Link></p>
        {directoryState==="ready"&&<>
        <div className="admin-section-heading"><div><p className="eyebrow">{adminT("Relationship affiliations")}</p><h2>{adminT("Company directory.")}</h2></div><span>{memberCompanies.length}  {adminT("declared records")}</span></div>
        <p className="admin-help">{adminT("Each entry is a relationship self-declared by a client or partner, not a verified legal entity. Company declarations never assign project rights.")}</p>
        <label className="admin-field admin-search">{adminT("Search companies and members")}<input type="search" value={search} disabled={locked} onChange={event => setSearch(event.target.value)} placeholder={adminT("Company, member, registration number or country")} /></label>
        <p className="admin-help">{visibleCompanies.length}  {adminT("matching company affiliations")}</p>
        {!visibleCompanies.length && <p className="admin-empty">{adminT("No member-declared companies match the current search.")}</p>}
        <div className="admin-requests">
          {visibleCompanies.map(company => {
            const member = relationships.find(account => account.id === company.user_id);
            return <article key={company.id} className="admin-request">
              <div className="admin-request-top"><div><h3>{company.legal_name}</h3>
                {company.trading_name && <p>{company.trading_name}</p>}
              </div><span className="admin-status">{adminT("Self-declared")}</span></div>
              <div className="admin-request-details">
                <p>{[company.country, company.registration_number].filter(Boolean).join(" · ") || adminT("No additional company details supplied")}</p>
                <p>{adminT("Relationship:")} {company.relationship_type.replace(/_/g, " ")} · {member?.full_name || member?.email || adminT("Member unavailable")}</p>
              </div>
              {member && <div className="admin-actions admin-space-top">
                <Link onClick={guardLink} className="admin-button" href={"/admin/relationships/" + encodeURIComponent(member.id)}>{adminT("Open relationship dossier →")}</Link>
              </div>}
            </article>;
          })}
        </div>
        </>}
      </>}

      {tab === "projects" && <>
        {offeringsState==="loading"&&<p role="status" className="admin-help">{adminT("Loading available project offerings…")}</p>}
        {offeringsState==="error"&&<p role="alert" className="admin-notice">{adminT("Project offerings could not be loaded. Refresh the dashboard to retry.")}</p>}
        <div className="admin-section-heading"><div><p className="eyebrow">{adminT("Private collection")}</p><h2>{adminT("Projects & access.")}</h2></div><div className="admin-actions"><Link className="admin-button" href="/admin/capital-requests">{adminT("Capital Requests →")}</Link><Link className="admin-button" href="/admin/project-access">{adminT("Manage permissions →")}</Link></div></div>
        <label className="admin-field admin-search">{adminT("Search projects")}<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={adminT("Property or location")} /></label>
        <div className="admin-project-grid">{visibleProjects.map(project => <article className="admin-panel" key={project.id}><span className="admin-status">{adminT(project.status)}</span><h3 className="admin-subtitle admin-space-top">{project.title}</h3><p className="admin-help">{project.location || adminT("Private collection")}</p><div className="admin-interests">{offeringsState==="ready"&&offerings.filter(item => item.project_id === project.id).map(item => <span key={item.id}>{adminT(labels[item.offering_type] ?? item.offering_type)}{item.title ? adminT("— {p0}", {p0: item.title}) : ""} · {adminT(item.status)}</span>)}</div><div className="admin-actions admin-space-top"><Link className="admin-button admin-button-primary" href={"/admin/projects/" + encodeURIComponent(project.id)}>{adminT("Open Project Cockpit →")}</Link>{project.status === "active" && <Link className="admin-button" href={`/admin/project-access?project=${encodeURIComponent(project.id)}`}>{adminT("Manage access →")}</Link>}</div></article>)}</div>
        {!visibleProjects.length && <p className="admin-empty">{adminT("No projects match this search.")}</p>}
      </>}

      {tab === "analytics" && <>
        <div className="admin-section-heading"><div><p className="eyebrow">{adminT("Public website")}</p><h2>{adminT("Website analytics.")}</h2></div><span className="admin-status">{adminT("Report in Vercel")}</span></div>
        <div className="admin-panel"><h3 className="admin-subtitle">{adminT("Vercel Web Analytics")}</h3><p className="admin-intro">{adminT("View visitors, page views and traffic sources in the existing Vercel report. Sign in with your authorised Vercel account.")}</p><a className="admin-button admin-button-primary admin-space-top" href={trafficReport} target="_blank" rel="noopener noreferrer">{adminT("Open MZS Analytics")} <ArrowUpRightIcon /></a><p className="admin-help admin-space-top">{adminT("Visitor figures are displayed in Vercel. They are not synchronised into this dashboard yet.")}</p></div>
        <div className="admin-project-grid"><article className="admin-panel"><p className="eyebrow">{adminT("Public traffic")}</p><h3 className="admin-subtitle">{adminT("Understand your audience.")}</h3><p className="admin-help">{adminT("Use the report to explore visited pages, countries, devices and referral sources over your selected period.")}</p></article><article className="admin-panel"><p className="eyebrow">{adminT("Private relationships")}</p><h3 className="admin-subtitle">{adminT("Review actual enquiries.")}</h3><p className="admin-help">{adminT("Access requests and account statuses are managed in Relationships. These are separate from website visitor counts.")}</p><button className="admin-button" onClick={() => openRequests("all")}>{adminT("View access requests →")}</button></article></div>
      </>}
    </section>
    <footer className="admin-footer">{adminT("Private. Independent. International.")}</footer>
  </main>;
}
