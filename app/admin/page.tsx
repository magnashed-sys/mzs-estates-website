"use client";

import "./admin.css";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import BookingManagement from "./BookingManagement";
import RequestProjectApproval, { type PlannedInvitation } from "./RequestProjectApproval";
import { assertComplete, matchesRequestFilter, matchesSearch, requestStage, type RequestFilter } from "./admin-model";

type AccessRequest = { id: string; full_name: string; email: string; company: string | null; country: string | null; interests: string[]; message: string | null; status: string; created_at: string; auth_user_id: string | null; email_verified_at: string | null };
type Relationship = { id: string; full_name: string | null; email: string; role: "client" | "partner"; is_active: boolean; created_at: string };
type Project = { id: string; title: string; location: string | null; status: string };
type Offering = { id: string; project_id: string; title: string; offering_type: string; status: string };
type Tab = "overview" | "relationships" | "projects" | "bookings" | "analytics";
type PageState = "loading" | "ready" | "denied" | "error";
const labels: Record<string, string> = { investment: "Investment", financing: "Private Capital", rental: "Private Rental", sale: "Private Sale" };
const tabs: [Tab, string][] = [["overview", "Overview"], ["relationships", "Relationships"], ["projects", "Projects & access"], ["bookings", "Bookings"], ["analytics", "Analytics"]];
const requestFilters: [RequestFilter, string][] = [["pending", "Pending"], ["approved", "Approved"], ["invitations", "Invitations"], ["declined", "Declined"], ["all", "All"]];
const pageSize = 12;
const trafficReport = "https://vercel.com/mzs3/mzs-group/analytics";
function date(value: string) { return new Date(value).toLocaleDateString("en-GB", { timeZone: "Europe/Madrid" }); }

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [invitations, setInvitations] = useState<PlannedInvitation[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [relationshipView, setRelationshipView] = useState<"requests" | "accounts">("requests");
  const [filter, setFilter] = useState<RequestFilter>("pending");
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
  const [limit, setLimit] = useState(pageSize);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [bookingEntry, setBookingEntry] = useState<"bookings" | "cancellations">("bookings");
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
      if (authError || !auth.user) { router.replace("/login"); return; }
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

      const results = await Promise.all([
        loadRequestRecords(),
        supabase.from("access_invitations").select("id,request_id,email,requested_role,status,invited_at", { count: "exact" }).order("invited_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,email,role,is_active,created_at", { count: "exact" }).in("role", ["client", "partner"]).order("created_at", { ascending: false }),
        supabase.from("projects").select("id,title,location,status", { count: "exact" }).order("title"),
        supabase.from("offerings").select("id,project_id,title,offering_type,status", { count: "exact" }).order("title"),
      ]);
      if (!current()) return;
      assertComplete(results);
      setRequests((results[0].data ?? []) as AccessRequest[]);
      setInvitations((results[1].data ?? []) as PlannedInvitation[]);
      setRelationships((results[2].data ?? []) as Relationship[]);
      setProjects((results[3].data ?? []) as Project[]);
      setOfferings((results[4].data ?? []) as Offering[]);
      setUpdated(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }));
      setState("ready");
      setRefreshVersion(value => value + 1);
    } catch (cause) {
      if (current()) { setError(cause instanceof Error ? cause.message : "Unable to load administration."); setState("error"); }
    } finally { if (current()) setRefreshing(false); }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    const initial = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some(([key]) => key === initial)) setTab(initial as Tab);
    void reload();
    return () => { mounted.current = false; generation.current += 1; };
  }, [reload]);

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
  const visibleAccounts = relationships.filter(item => matchesSearch(search, item.full_name, item.email)
    && (accountRole === "all" || accountRole === item.role)
    && (accountStatus === "all" || item.is_active === (accountStatus === "active")));
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
      "Send one MZS Group test notification to your own administrator email address?\\n\\nNo clients, partners or project permissions will be affected."
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

  function navigate(next: Tab) {
    if (locked || actionLock.current) return;
    setTab(next); setSearch(""); setLimit(pageSize); setNotice("");
  }
  function openRequests(next: RequestFilter) { navigate("relationships"); setRelationshipView("requests"); setFilter(next); }
  function openBookings(section: "bookings" | "cancellations") { navigate("bookings"); setBookingEntry(section); }

  async function runAction(key: string, action: () => Promise<string>) {
    if (actionLock.current || locked) return;
    actionLock.current = true; setBusy(key); setNotice("");
    try { const text = await action(); if (mounted.current) setNotice(text); }
    catch { if (mounted.current) { setError("The result could not be confirmed. Reload to verify the recorded status before another action."); setState("error"); } }
    finally { actionLock.current = false; if (mounted.current) setBusy(null); }
  }
  function decline(request: AccessRequest) {
    if (request.status !== "pending" || invitationMap.has(request.id) || locked) return;
    if (!window.confirm(`Decline the request from ${request.full_name} (${request.email})?`)) return;
    void runAction(request.id, async () => {
      const { data, error: failure } = await createClient().rpc("review_access_request", { p_request_id: request.id, p_decision: "declined" });
      if (failure || data !== true) throw new Error("Review not confirmed");
      await reload(); return "Request declined.";
    });
  }
  function changeAccount(account: Relationship) {
    const activate = !account.is_active;
    if (locked || !window.confirm(`${activate ? "Activate" : "Deactivate"} ${account.email}?\n\n${activate ? "Existing assigned projects become accessible again." : "Private access will be blocked."}`)) return;
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
    <p className="eyebrow">MZS Administration</p>
    <h1>{state === "loading" ? "Preparing your workspace." : state === "denied" ? "Access restricted." : "Unable to load."}</h1>
    <p role={state === "error" ? "alert" : "status"}>{state === "loading" ? "Verifying administrator access…" : state === "denied" ? "Active administrator access is required." : error}</p>
    {state === "error" && <button className="admin-button" disabled={refreshing} onClick={() => void reload()}>Try again</button>}
    <Link href="/login">Return to login →</Link>
  </div></main>;

  return <main className="admin-page">
    <header className="admin-header"><Link href="/" onClick={guardLink} className="admin-brand">MZS GROUP</Link><div className="admin-header-actions"><span>Private administration</span><button disabled={locked} onClick={() => void signOut()}>{busy === "signout" ? "Signing out…" : "Sign out"}</button></div></header>
    <section className="admin-content">
      <div className="admin-heading-row"><div><p className="eyebrow">MZS Administration</p><h1>Private management.</h1><p className="admin-intro">Your relationships, properties and reservations in one place.</p></div><div className="admin-refresh"><button className="admin-button" disabled={locked} onClick={() => void reload()}>{refreshing ? "Refreshing…" : "Refresh dashboard"}</button><small>{updated ? `Dashboard updated ${updated} · Madrid time` : ""}</small></div></div>
      <nav className="admin-nav" aria-label="Administration sections">{tabs.map(([key, label]) => <button key={key} disabled={locked} aria-current={tab === key ? "page" : undefined} onClick={() => navigate(key)}>{label}{key === "relationships" && pending.length > 0 && <span className="admin-count">{pending.length}</span>}</button>)}</nav>
      {reviewing && <p className="admin-help">Close the open review to switch sections, change filters or refresh the dashboard.</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}

      {tab === "overview" && <>
        <div className="admin-metrics">
          <button disabled={locked} onClick={() => openRequests("pending")}><span>Access requests</span><strong>{pending.length}</strong><small>Awaiting review →</small></button>
          <button disabled={locked} onClick={() => openRequests("approved")}><span>Approved requests</span><strong>{approved.length}</strong><small>Awaiting invitation →</small></button>
          <button disabled={locked} onClick={() => { navigate("relationships"); setRelationshipView("accounts"); }}><span>Active relationships</span><strong>{activeCount}</strong><small>{relationships.length} total accounts →</small></button>
          <button disabled={locked} onClick={() => navigate("projects")}><span>Active projects</span><strong>{projects.filter(p => p.status === "active").length}</strong><small>View collection →</small></button>
        </div>
        <div className="admin-section-heading"><div><p className="eyebrow">Your next actions</p><h2>Needs attention.</h2></div></div>
        <div className="admin-panel">
          {!pending.length && !approved.length && !attentionInvites.length && <p className="admin-help">No relationship actions waiting. Check rental requests below.</p>}
          {attentionInvites.length > 0 && <button className="admin-action-row" disabled={locked} onClick={() => openRequests("invitations")}><span><strong>{attentionInvites.length} invitations need review</strong><small>Check their recorded status before sending again.</small></span><span aria-hidden="true">→</span></button>}
          {pending.slice(0, 4).map(item => <button className="admin-action-row" key={item.id} disabled={locked} onClick={() => { openRequests("pending"); setReviewing(item.id); }}><span><strong>{item.full_name}</strong><small>New access request · {date(item.created_at)}</small></span><span>Review →</span></button>)}
          {approved.length > 0 && <button className="admin-action-row" disabled={locked} onClick={() => openRequests("approved")}><span><strong>{approved.length} approved requests awaiting invitation</strong><small>Review the selected projects and account type.</small></span><span aria-hidden="true">→</span></button>}
        </div>
        <BookingManagement key={`summary-${refreshVersion}`} mode="summary" onNavigate={openBookings} />
        <div className="admin-panel admin-analytics-banner"><div><p className="eyebrow">Website insights</p><h3 className="admin-subtitle">Vercel Analytics</h3><p className="admin-help">Open the traffic report for your public website.</p></div><button className="admin-button" disabled={locked} onClick={() => navigate("analytics")}>View analytics →</button></div>
      </>}

      {tab === "relationships" && <>
        <div className="admin-panel" style={{ marginBottom: 28 }}>
          <h3 className="admin-subtitle">Account notification email</h3>
          <p className="admin-help">
            Check whether MZS Group can connect securely to the existing
            invitation mailbox. No passwords or email account details are shown.
          </p>
          <button className="admin-button" type="button"
            disabled={smtpChecking || locked}
            onClick={() => void checkSmtpConnection()}>
            {smtpChecking ? "Checking connection..." : "Verify SMTP connection"}
          </button>
          {smtpStatus && (
            <p role="status" className="admin-help">
              {smtpStatus.connectionVerified
                ? "SMTP login and secure connection verified. A real delivery test is still required before release."
                : smtpStatus.configured
                  ? "SMTP settings detected but the connection test failed. Check credentials, network and server policy in Vercel."
                  : "Mail server settings are incomplete: " + smtpStatus.missing.join(", ")}
            </p>
          )}
          {smtpStatus?.connectionVerified && (
            <div style={{ marginTop: 18 }}>
              <p className="admin-help">
                The next check sends one real message only to your own
                administrator mailbox. It does not register or contact customers.
              </p>
              <button type="button" className="admin-button"
                disabled={smtpTestSending || smtpChecking || locked}
                onClick={() => void sendSmtpTest()}>
                {smtpTestSending ? "Sending test email..." : "Send test email to my address →"}
              </button>
            </div>
          )}
          {smtpTestResult && <p className="admin-help" role="status">{smtpTestResult}</p>}
          {smtpTestError && <p className="admin-notice" role="alert">{smtpTestError}</p>}
          {smtpCheckError && <p className="admin-notice" role="alert">{smtpCheckError}</p>}
        </div>
        <div className="admin-section-heading"><div><p className="eyebrow">Selected relationships</p><h2>People & access.</h2></div></div>
        <div className="admin-toolbar"><div className="admin-filters">{(["requests", "accounts"] as const).map(view => <button key={view} disabled={locked} aria-pressed={relationshipView === view} onClick={() => { setRelationshipView(view); setLimit(pageSize); setSearch(""); }}>{view === "requests" ? "Requests & invitations" : "Accounts"}</button>)}</div><label className="admin-field">Search relationships<input type="search" value={search} disabled={locked} placeholder="Name, email or company" onChange={event => { setSearch(event.target.value); setLimit(pageSize); }} /></label></div>
        {relationshipView === "requests" ? <>
          <div className="admin-filters">{requestFilters.map(([key, label]) => <button key={key} disabled={locked} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(pageSize); }}>{label} <span>({requests.filter(item => matchesRequestFilter(item.status, invitationMap.get(item.id), key)).length})</span></button>)}</div>
          <p className="admin-help">{visibleRequests.length} matching requests</p>
          {!visibleRequests.length && <p className="admin-empty">No requests match these filters.</p>}
          <div className="admin-requests">{visibleRequests.slice(0, limit).map(request => {
            const invitation = invitationMap.get(request.id);
            const stage = request.auth_user_id
              ? (request.status === "approved" ? "activated" : request.email_verified_at ? "verified_pending" : "awaiting_email_verification")
              : requestStage(request.status, invitation);
            return <article key={request.id} className="admin-request">
              <div className="admin-request-top"><div><h3>{request.full_name}</h3><p>{request.email}</p></div><span className={`admin-status ${stage === "needs_review" ? "admin-status-warning" : ""}`}>{stage.replace(/_/g, " ")}</span></div>
              <div className="admin-request-details">{request.company && <p>{request.company}</p>}{request.country && <p>{request.country}</p>}<p>Received {date(request.created_at)}</p></div>
              <div className="admin-interests">{(request.interests ?? []).map(interest => <span key={interest}>{labels[interest] ?? interest}</span>)}</div>
              {request.message && <p className="admin-request-message">{request.message}</p>}
              {!invitation && (request.auth_user_id ? request.status === "pending" : ["pending", "approved"].includes(request.status)) && <div className="admin-actions admin-space-top"><button className="admin-button admin-button-primary" disabled={locked} onClick={() => setReviewing(request.id)}>{request.auth_user_id ? "Review verified account" : request.status === "pending" ? "Review & select projects" : "Project selection & invitation"}</button>{request.status === "pending" && <button className="admin-button" disabled={locked} onClick={() => decline(request)}>Decline</button>}</div>}
              {reviewing === request.id && <RequestProjectApproval request={request} onApproved={id => setRequests(items => items.map(item => item.id === id ? { ...item, status: "approved" } : item))} onInvited={recordInvitation} onClose={() => { setReviewing(null); void reload(); }} />}
              {invitation && <p className="admin-help admin-space-top">{stage === "registered" ? "Registration completed. Manage assigned rights in Project Access." : stage === "invited" ? "Invitation sent. Registration is a separate step." : "Check the invitation outcome before another attempt."}</p>}
            </article>;
          })}</div>
          {visibleRequests.length > limit && <button className="admin-button admin-space-top" disabled={locked} onClick={() => setLimit(value => value + pageSize)}>Show more requests</button>}
        </> : <>
          <div className="admin-toolbar"><label className="admin-field">Account type<select disabled={locked} value={accountRole} onChange={event => { setAccountRole(event.target.value); setLimit(pageSize); }}><option value="all">All types</option><option value="client">Client</option><option value="partner">Partner</option></select></label><label className="admin-field">Status<select disabled={locked} value={accountStatus} onChange={event => { setAccountStatus(event.target.value); setLimit(pageSize); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
          <p className="admin-help">{visibleAccounts.length} matching accounts</p>
          {!visibleAccounts.length && <p className="admin-empty">No accounts match these filters.</p>}
          <div className="admin-requests">{visibleAccounts.slice(0, limit).map(account => <article key={account.id} className="admin-request"><div className="admin-request-top"><div><h3>{account.full_name || "Unnamed relationship"}</h3><p>{account.email}</p></div><span className="admin-status">{account.is_active ? "Active" : "Inactive"} · {account.role}</span></div><div className="admin-request-details"><p>Created {date(account.created_at)}</p></div><div className="admin-actions admin-space-top"><Link onClick={guardLink} className="admin-button" href={`/admin/project-access?user=${encodeURIComponent(account.id)}`}>Manage project access →</Link><button className="admin-button" disabled={locked || (!account.is_active && requests.some(req => req.auth_user_id === account.id && req.status !== "approved"))} onClick={() => changeAccount(account)}>{busy === account.id ? "Processing…" : account.is_active ? "Deactivate" : "Activate"}</button></div></article>)}</div>
          {visibleAccounts.length > limit && <button className="admin-button admin-space-top" disabled={locked} onClick={() => setLimit(value => value + pageSize)}>Show more accounts</button>}
        </>}
      </>}

      {tab === "projects" && <>
        <div className="admin-section-heading"><div><p className="eyebrow">Private collection</p><h2>Projects & access.</h2></div><Link className="admin-button" href="/admin/project-access">Manage permissions →</Link></div>
        <label className="admin-field admin-search">Search projects<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Property or location" /></label>
        <div className="admin-project-grid">{visibleProjects.map(project => <article className="admin-panel" key={project.id}><span className="admin-status">{project.status}</span><h3 className="admin-subtitle admin-space-top">{project.title}</h3><p className="admin-help">{project.location || "Private collection"}</p><div className="admin-interests">{offerings.filter(item => item.project_id === project.id).map(item => <span key={item.id}>{labels[item.offering_type] ?? item.offering_type}{item.title ? ` — ${item.title}` : ""} · {item.status}</span>)}</div>{project.status === "active" && <Link className="admin-button admin-space-top" href={`/admin/project-access?project=${encodeURIComponent(project.id)}`}>Manage access →</Link>}</article>)}</div>
        {!visibleProjects.length && <p className="admin-empty">No projects match this search.</p>}
      </>}

      {tab === "bookings" && <><div className="admin-section-heading"><div><p className="eyebrow">Private rental</p><h2>Reservations & calendar.</h2></div></div><BookingManagement key={`bookings-${refreshVersion}`} initialSection={bookingEntry} onBusyChange={setBookingBusy} /></>}

      {tab === "analytics" && <>
        <div className="admin-section-heading"><div><p className="eyebrow">Public website</p><h2>Website analytics.</h2></div><span className="admin-status">Report in Vercel</span></div>
        <div className="admin-panel"><h3 className="admin-subtitle">Vercel Web Analytics</h3><p className="admin-intro">View visitors, page views and traffic sources in the existing Vercel report. Sign in with your authorised Vercel account.</p><a className="admin-button admin-button-primary admin-space-top" href={trafficReport} target="_blank" rel="noopener noreferrer">Open MZS Analytics ↗</a><p className="admin-help admin-space-top">Visitor figures are displayed in Vercel. They are not synchronised into this dashboard yet.</p></div>
        <div className="admin-project-grid"><article className="admin-panel"><p className="eyebrow">Public traffic</p><h3 className="admin-subtitle">Understand your audience.</h3><p className="admin-help">Use the report to explore visited pages, countries, devices and referral sources over your selected period.</p></article><article className="admin-panel"><p className="eyebrow">Private relationships</p><h3 className="admin-subtitle">Review actual enquiries.</h3><p className="admin-help">Access requests and account statuses are managed in Relationships. These are separate from website visitor counts.</p><button className="admin-button" onClick={() => openRequests("all")}>View access requests →</button></article></div>
      </>}
    </section>
    <footer className="admin-footer">Private. Independent. International.</footer>
  </main>;
}
