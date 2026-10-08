
"use client";

import "./admin.css";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type AccessRequest = {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  country: string | null;
  interests: string[];
  message: string | null;
  status: string;
  created_at: string;
};

type Invitation = {
  id: string;
  request_id: string;
  email: string;
  requested_role: "client" | "partner";
  status: string;
  invited_at: string;
};

type Relationship = {
  id: string;
  full_name: string | null;
  email: string;
  role: "client" | "partner";
  is_active: boolean;
  created_at: string;
};

type PageState = "loading" | "ready" | "denied" | "error";
type InviteRole = "client" | "partner";
type Decision = "approved" | "declined";

const offeringLabels: Record<string, string> = {
  investment: "Investment",
  financing: "Financing",
  rental: "Private Rental",
  sale: "Private Sale",
};

export default function AdminPage() {
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAdmin() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace("/login?role=client");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (profileError) {
        setErrorMessage("Unable to verify administrator access.");
        setPageState("error");
        return;
      }

      if (profile?.role !== "admin" || !profile.is_active) {
        setPageState("denied");
        return;
      }

      const [requestsResult, invitationsResult, relationshipsResult] = await Promise.all([
        supabase.from("access_requests")
          .select("id, full_name, email, company, country, interests, message, status, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("access_invitations")
          .select("id, request_id, email, requested_role, status, invited_at")
          .order("invited_at", { ascending: false }),
        supabase.from("profiles")
          .select("id, full_name, email, role, is_active, created_at")
          .in("role", ["client", "partner"])
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (requestsResult.error || invitationsResult.error || relationshipsResult.error) {
        setErrorMessage("Unable to retrieve administration records.");
        setPageState("error");
        return;
      }
      setRequests((requestsResult.data ?? []) as AccessRequest[]);
      setInvitations((invitationsResult.data ?? []) as Invitation[]);
      setRelationships((relationshipsResult.data ?? []) as Relationship[]);
      setPageState("ready");
    }

    void loadAdmin();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleReview(
    request: AccessRequest,
    decision: Decision
  ) {
    if (processingId || request.status !== "pending") return;

    const confirmed = window.confirm(
      decision === "approved"
        ? `Approve the access request from ${request.full_name}? This does not create an account or grant access.`
        : `Decline the access request from ${request.full_name}?`
    );

    if (!confirmed) return;

    setProcessingId(request.id);
    setNotice("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "review_access_request",
        {
          p_request_id: request.id,
          p_decision: decision,
        }
      );

      if (error) throw error;

      if (data !== true) {
        setNotice(
          "This request was already processed or is no longer pending. Refresh the page."
        );
        return;
      }

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? { ...item, status: decision }
            : item
        )
      );

      setNotice(
        decision === "approved"
          ? "Request approved. No account or access has been created."
          : "Request declined."
      );
    } catch {
      setNotice(
        "Unable to update this request. Please try again."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleInvite(request: AccessRequest, role: InviteRole) {
    if (processingId || request.status !== "approved") return;
    if (invitations.some((item) => item.request_id === request.id)) {
      setNotice("An invitation record already exists for this request.");
      return;
    }
    if (!window.confirm(`Send a ${role.toUpperCase()} invitation to ${request.full_name} (${request.email})?\n\nThe account will remain inactive until MZS approves activation.`)) return;
    setProcessingId(request.id);
    setNotice("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("invite-approved-relationship", {
        body: { request_id: request.id, role },
      });
      if (error || data?.ok !== true) {
        setNotice("Invitation could not be confirmed. Check Supabase before retrying.");
        return;
      }
      const { data: updated, error: reloadError } = await supabase.from("access_invitations")
        .select("id, request_id, email, requested_role, status, invited_at")
        .eq("request_id", request.id).single();
      if (reloadError || !updated) {
        setNotice("Invitation sent, but its status could not be refreshed. Reload the page.");
        return;
      }
      setInvitations((current) => [updated as Invitation, ...current.filter((item) => item.request_id !== request.id)]);
      const { data: accounts } = await supabase.from("profiles")
        .select("id, full_name, email, role, is_active, created_at")
        .in("role", ["client", "partner"]).order("created_at", { ascending: false });
      if (accounts) setRelationships(accounts as Relationship[]);
      setNotice(`Invitation sent to ${request.email}. The account remains inactive.`);
    } catch {
      setNotice("Unable to confirm invitation outcome. Review Supabase before attempting again.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAccountStatus(account: Relationship, activate: boolean) {
    if (processingId || account.is_active === activate) return;
    const action = activate ? "ACTIVATE" : "DEACTIVATE";
    if (!window.confirm(`${action} ${account.full_name || account.email} (${account.email})?\n\n${activate ? "This permits private sign-in, but does not assign projects." : "This blocks private access."}`)) return;
    setProcessingId(account.id);
    setNotice("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("set_relationship_active", {
        p_user_id: account.id, p_active: activate,
      });
      if (error || data !== true) throw error ?? new Error("Update not confirmed");
      const { data: verified, error: verifyError } = await supabase.from("profiles")
        .select("is_active").eq("id", account.id).single();
      if (verifyError || !verified || verified.is_active !== activate) {
        setNotice("Account status could not be verified. Refresh before another action.");
        return;
      }
      setRelationships((current) => current.map((item) =>
        item.id === account.id ? { ...item, is_active: activate } : item));
      setNotice(`${account.email} is now ${activate ? "active" : "inactive"}.`);
    } catch {
      setNotice("Unable to change account status. Please check and try again.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (pageState === "loading") {
    return (
      <main className="admin-page">
        <p className="admin-message">
          Verifying administrator access...
        </p>
      </main>
    );
  }

  if (pageState === "denied") {
    return (
      <main className="admin-page">
        <div className="admin-message">
          <p className="eyebrow">MZS GROUP</p>
          <h1>Access restricted.</h1>
          <p>This area is reserved for MZS administrators.</p>
          <Link href="/private">
            Return to private environment →
          </Link>
        </div>
      </main>
    );
  }

  if (pageState === "error") {
    return (
      <main className="admin-page">
        <div className="admin-message">
          <h1>Unable to continue.</h1>
          <p>{errorMessage}</p>
        </div>
      </main>
    );
  }

  const pendingCount = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const sentCount = invitations.filter((item) => item.status === "sent").length;
  const activeCount = relationships.filter((item) => item.is_active).length;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/" className="admin-brand">
          MZS GROUP
        </Link>

        <div className="admin-header-actions">
          <span>Administration</span>
          <button type="button" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <section className="admin-content">
        <p className="eyebrow">MZS Administration</p>

        <h1>Private management.</h1>

        <p className="admin-intro">
          Manage selected relationships and access to private
          MZS opportunities.
        </p>

        <div className="admin-stats">
          <div>
            <span>Access Requests</span>
            <strong>{requests.length}</strong>
          </div>

          <div>
            <span>Pending Review</span>
            <strong>{pendingCount}</strong>
          </div>
        </div>

        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">Relationships</p>
            <h2>Access requests</h2>
          </div>

          <span>{sentCount} invitations sent</span>
        </div>

        {notice && (
          <p role="status" style={{
            color: "#d5c09a",
            fontSize: "12px",
            marginBottom: "24px",
            lineHeight: 1.7,
          }}>
            {notice}
          </p>
        )}

        {requests.length === 0 ? (
          <p className="admin-empty">
            No access requests have been received.
          </p>
        ) : (
          <div className="admin-requests">
            {requests.map((request) => {
              const invitation = invitations.find((item) => item.request_id === request.id);
              return (
              <article
                className="admin-request"
                key={request.id}
              >
                <div className="admin-request-top">
                  <div>
                    <h3>{request.full_name}</h3>
                    <p>{request.email}</p>
                  </div>

                  <span className="admin-status">
                    {invitation?.status === "sent" ? "Invited"
                      : invitation?.status === "needs_review" ? "Needs Review"
                      : invitation ? "Invitation Reserved" : request.status}
                  </span>
                </div>

                <div className="admin-request-details">
                  {request.company && (
                    <p>Company: {request.company}</p>
                  )}

                  {request.country && (
                    <p>Country: {request.country}</p>
                  )}

                  <p>
                    Received:{" "}
                    {new Date(
                      request.created_at
                    ).toLocaleDateString("en-GB")}
                  </p>
                </div>

                <div className="admin-interests">
                  {(request.interests ?? []).map((interest) => (
                    <span key={interest}>
                      {offeringLabels[interest] ?? interest}
                    </span>
                  ))}
                </div>

                {request.message && (
                  <p className="admin-request-message">
                    {request.message}
                  </p>
                )}

                {request.status === "pending" && (
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "28px",
                  }}>
                    <button
                      type="button"
                      disabled={processingId !== null}
                      onClick={() =>
                        handleReview(request, "approved")
                      }
                      style={{
                        padding: "13px 22px",
                        background: "#d5c09a",
                        border: "1px solid #d5c09a",
                        color: "#0b0b0a",
                        cursor: "pointer",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      {processingId === request.id
                        ? "Processing..."
                        : "Approve"}
                    </button>

                    <button
                      type="button"
                      disabled={processingId !== null}
                      onClick={() =>
                        handleReview(request, "declined")
                      }
                      style={{
                        padding: "13px 22px",
                        background: "transparent",
                        border: "1px solid #665a45",
                        color: "#d5c09a",
                        cursor: "pointer",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {request.status === "approved" && !invitation && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "28px" }}>
                    <button type="button" disabled={processingId !== null}
                      onClick={() => handleInvite(request, "client")}
                      style={{ padding: "13px 22px", background: "#d5c09a", border: "1px solid #d5c09a", color: "#0b0b0a", cursor: "pointer", fontSize: "10px", letterSpacing: "0.12em" }}>
                      {processingId === request.id ? "Processing..." : "Invite Client"}
                    </button>
                    <button type="button" disabled={processingId !== null}
                      onClick={() => handleInvite(request, "partner")}
                      style={{ padding: "13px 22px", background: "transparent", border: "1px solid #665a45", color: "#d5c09a", cursor: "pointer", fontSize: "10px", letterSpacing: "0.12em" }}>
                      Invite Partner
                    </button>
                  </div>
                )}
                {invitation && (
                  <p style={{ color: "#a9a398", fontSize: "12px", lineHeight: 1.7, marginTop: "24px" }}>
                    {invitation.status === "sent"
                      ? "Invitation sent. Account activation and project permissions are managed separately."
                      : "This invitation requires administrator review before another attempt."}
                  </p>
                )}
              </article>
              );
            })}
          </div>
        )}
        <div className="admin-section-heading" style={{ marginTop: "72px" }}>
          <div><p className="eyebrow">Relationships</p><h2>Account management</h2></div>
          <span>{activeCount} active / {relationships.length} accounts</span>
        </div>

        {relationships.length === 0 ? (
          <p className="admin-empty">No client or partner accounts found.</p>
        ) : (
          <div className="admin-requests">
            {relationships.map((account) => (
              <article className="admin-request" key={account.id}>
                <div className="admin-request-top">
                  <div>
                    <h3>{account.full_name || "Unnamed relationship"}</h3>
                    <p>{account.email}</p>
                  </div>
                  <span className="admin-status">{account.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="admin-request-details">
                  <p>Role: {account.role === "partner" ? "Partner" : "Client"}</p>
                  <p>Created: {new Date(account.created_at).toLocaleDateString("en-GB")}</p>
                </div>
                <div style={{ marginTop: "28px" }}>
                  <button type="button" disabled={processingId !== null}
                    onClick={() => handleAccountStatus(account, !account.is_active)}
                    style={{ padding: "13px 22px", background: account.is_active ? "transparent" : "#d5c09a", border: "1px solid #d5c09a", color: account.is_active ? "#d5c09a" : "#0b0b0a", cursor: "pointer", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {processingId === account.id ? "Processing..." : account.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="admin-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}
