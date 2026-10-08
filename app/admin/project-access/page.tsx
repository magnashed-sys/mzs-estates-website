
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import "../admin.css";

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
};

type Project = {
  id: string;
  title: string;
  location: string | null;
  status: string;
};

type Offering = {
  id: string;
  project_id: string;
  title: string;
  offering_type: string;
  status: string;
};

type ProjectGrant = {
  user_id: string;
  project_id: string;
};

type OfferingGrant = {
  user_id: string;
  offering_id: string;
};

type PageState = "loading" | "ready" | "denied" | "error";

const gold = "#d5c09a";
const muted = "#a9a398";

const offeringLabels: Record<string, string> = {
  investment: "Investment",
  sale: "Private Sale",
  rental: "Private Rental",
  financing: "Financing",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  background: "#141412",
  border: "1px solid #48443d",
  borderRadius: 0,
  color: "#ece8df",
  fontSize: "15px",
  marginTop: "12px",
};

const actionStyle: React.CSSProperties = {
  padding: "15px 24px",
  border: `1px solid ${gold}`,
  background: gold,
  color: "#0b0b0a",
  fontSize: "12px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
};

export default function ProjectAccessPage() {
  const router = useRouter();

  const [pageState, setPageState] =
    useState<PageState>("loading");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);

  const [projectGrants, setProjectGrants] =
    useState<ProjectGrant[]>([]);

  const [offeringGrants, setOfferingGrants] =
    useState<OfferingGrant[]>([]);

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  const [selectedOfferings, setSelectedOfferings] =
    useState<string[]>([]);

  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError || !user) {
        router.replace("/login?role=client");
        return;
      }

      const { data: adminProfile, error: adminError } =
        await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", user.id)
          .single();

      if (!mounted) return;

      if (
        adminError ||
        adminProfile?.role !== "admin" ||
        adminProfile.is_active !== true
      ) {
        setPageState("denied");
        return;
      }

      const [
        profilesResult,
        projectsResult,
        offeringsResult,
        projectAccessResult,
        offeringAccessResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, is_active")
          .in("role", ["client", "partner"])
          .order("full_name"),

        supabase
          .from("projects")
          .select("id, title, location, status")
          .eq("status", "active")
          .order("title"),

        supabase
          .from("offerings")
          .select(
            "id, project_id, title, offering_type, status"
          )
          .eq("status", "active")
          .order("title"),

        supabase
          .from("project_access")
          .select("user_id, project_id"),

        supabase
          .from("offering_access")
          .select("user_id, offering_id"),
      ]);

      if (!mounted) return;

      const hasError = [
        profilesResult,
        projectsResult,
        offeringsResult,
        projectAccessResult,
        offeringAccessResult,
      ].some((result) => result.error);

      if (hasError) {
        setErrorMessage(
          "Unable to retrieve project access information."
        );
        setPageState("error");
        return;
      }

      setProfiles((profilesResult.data ?? []) as Profile[]);
      setProjects((projectsResult.data ?? []) as Project[]);
      setOfferings((offeringsResult.data ?? []) as Offering[]);

      setProjectGrants(
        (projectAccessResult.data ?? []) as ProjectGrant[]
      );

      setOfferingGrants(
        (offeringAccessResult.data ?? []) as OfferingGrant[]
      );

      setPageState("ready");
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, [router]);

  const currentProfile = profiles.find(
    (profile) => profile.id === selectedUser
  );

  const currentProject = projects.find(
    (project) => project.id === selectedProject
  );

  const availableOfferings = offerings.filter(
    (offering) => offering.project_id === selectedProject
  );

  function loadSelection(userId: string, projectId: string) {
    const offeringIds = new Set(
      availableOfferingsFor(projectId).map(
        (offering) => offering.id
      )
    );

    const hasProjectAccess = projectGrants.some(
      (grant) =>
        grant.user_id === userId &&
        grant.project_id === projectId
    );

    const grantedIds = hasProjectAccess
      ? offeringGrants
          .filter(
            (grant) =>
              grant.user_id === userId &&
              offeringIds.has(grant.offering_id)
          )
          .map((grant) => grant.offering_id)
      : [];

    setSelectedOfferings(grantedIds);
    setDirty(false);
    setNotice("");
  }

  function availableOfferingsFor(projectId: string) {
    return offerings.filter(
      (offering) => offering.project_id === projectId
    );
  }

  function handleUserChange(userId: string) {
    setSelectedUser(userId);
    loadSelection(userId, selectedProject);
  }

  function handleProjectChange(projectId: string) {
    setSelectedProject(projectId);
    loadSelection(selectedUser, projectId);
  }

  function toggleOffering(offeringId: string) {
    setSelectedOfferings((current) =>
      current.includes(offeringId)
        ? current.filter((id) => id !== offeringId)
        : [...current, offeringId]
    );

    setDirty(true);
    setNotice("");
  }

  async function saveAccess() {
    if (
      saving ||
      !dirty ||
      !selectedUser ||
      !selectedProject ||
      !currentProfile ||
      !currentProject
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Update project access?\n\n` +
        `Account: ${currentProfile.email}\n` +
        `Project: ${currentProject.title}\n\n` +
        `Selected offerings: ${selectedOfferings.length}\n\n` +
        `Unselected offerings will lose access.`
    );

    if (!confirmed) return;

    setSaving(true);
    setNotice("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "set_relationship_project_access",
        {
          p_user_id: selectedUser,
          p_project_id: selectedProject,
          p_offering_ids: selectedOfferings,
        }
      );

      if (error) throw error;

      if (data !== selectedOfferings.length) {
        throw new Error("Unexpected access update result");
      }

      // Read the authoritative state back from Supabase.
      const [projectResult, offeringResult] =
        await Promise.all([
          supabase
            .from("project_access")
            .select("user_id, project_id")
            .eq("user_id", selectedUser)
            .eq("project_id", selectedProject),

          supabase
            .from("offering_access")
            .select("user_id, offering_id")
            .eq("user_id", selectedUser),
        ]);

      if (projectResult.error || offeringResult.error) {
        setNotice(
          "Access was updated, but verification failed. Refresh before making further changes."
        );
        return;
      }

      const projectOfferingIds = new Set(
        availableOfferings.map((offering) => offering.id)
      );

      const verifiedGrants = (
        offeringResult.data ?? []
      ).filter((grant) =>
        projectOfferingIds.has(grant.offering_id)
      );

      setProjectGrants((current) => [
        ...current.filter(
          (grant) =>
            !(
              grant.user_id === selectedUser &&
              grant.project_id === selectedProject
            )
        ),
        ...((projectResult.data ?? []) as ProjectGrant[]),
      ]);

      setOfferingGrants((current) => [
        ...current.filter(
          (grant) =>
            !(
              grant.user_id === selectedUser &&
              projectOfferingIds.has(grant.offering_id)
            )
        ),
        ...(verifiedGrants as OfferingGrant[]),
      ]);

      setSelectedOfferings(
        verifiedGrants.map((grant) => grant.offering_id)
      );

      setDirty(false);
      setNotice("Project access updated successfully.");
    } catch {
      setNotice(
        "Unable to confirm the access change. Refresh the page and verify the current permissions before retrying."
      );
    } finally {
      setSaving(false);
    }
  }

  if (pageState !== "ready") {
    return (
      <main className="admin-page">
        <div className="admin-message">
          {pageState === "loading" && (
            <p>Verifying administrator access...</p>
          )}

          {pageState === "denied" && (
            <>
              <h1>Access restricted.</h1>
              <p>Administrator access is required.</p>
            </>
          )}

          {pageState === "error" && (
            <>
              <h1>Unable to continue.</h1>
              <p>{errorMessage}</p>
            </>
          )}

          <Link href="/admin">Return to Admin →</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/" className="admin-brand">
          MZS GROUP
        </Link>

        <div className="admin-header-actions">
          <span>Project Access</span>
          <Link href="/admin">← Admin Dashboard</Link>
        </div>
      </header>

      <section className="admin-content">
        <p className="eyebrow">MZS Administration</p>

        <h1>Project access.</h1>

        <p className="admin-intro">
          Manage individual project and offering
          permissions for selected clients and partners.
        </p>

        <div
          style={{
            maxWidth: "780px",
            marginTop: "55px",
          }}
        >
          <div style={{ marginBottom: "32px" }}>
            <label
              htmlFor="mzs-client"
              style={{
                color: muted,
                fontSize: "12px",
                letterSpacing: "0.14em",
              }}
            >
              SELECT CLIENT OR PARTNER
            </label>

            <select
              id="mzs-client"
              style={selectStyle}
              value={selectedUser}
              disabled={saving}
              onChange={(event) =>
                handleUserChange(event.target.value)
              }
            >
              <option value="">Select relationship...</option>

              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name || profile.email}
                  {" — "}
                  {profile.role}
                  {profile.is_active ? "" : " (Inactive)"}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "36px" }}>
            <label
              htmlFor="mzs-project"
              style={{
                color: muted,
                fontSize: "12px",
                letterSpacing: "0.14em",
              }}
            >
              SELECT PROJECT
            </label>

            <select
              id="mzs-project"
              style={selectStyle}
              value={selectedProject}
              disabled={saving}
              onChange={(event) =>
                handleProjectChange(event.target.value)
              }
            >
              <option value="">Select project...</option>

              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          {currentProfile && currentProject && (
            <div
              style={{
                borderTop: "1px solid #48443d",
                paddingTop: "35px",
              }}
            >
              <p className="eyebrow">
                Offering Permissions
              </p>

              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontWeight: 400,
                  fontSize: "32px",
                  marginBottom: "12px",
                }}
              >
                {currentProject.title}
              </h2>

              <p
                style={{
                  color: muted,
                  fontSize: "14px",
                  marginBottom: "32px",
                }}
              >
                {currentProfile.email}
                {" · "}
                {currentProfile.is_active
                  ? "Active Account"
                  : "Inactive Account"}
              </p>

              {availableOfferings.length === 0 ? (
                <p style={{ color: muted }}>
                  No active offerings available.
                </p>
              ) : (
                availableOfferings.map((offering) => (
                  <label
                    key={offering.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "18px",
                      padding: "22px 0",
                      borderBottom: "1px solid #35332e",
                      cursor: saving ? "wait" : "pointer",
                      color: "#ece8df",
                      fontSize: "15px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOfferings.includes(
                        offering.id
                      )}
                      disabled={saving}
                      onChange={() =>
                        toggleOffering(offering.id)
                      }
                      style={{
                        width: "18px",
                        height: "18px",
                        accentColor: gold,
                      }}
                    />

                    <span>
                      {offeringLabels[offering.offering_type] ??
                        offering.title}
                    </span>
                  </label>
                ))
              )}

              <p
                style={{
                  color: muted,
                  fontSize: "13px",
                  lineHeight: 1.7,
                  marginTop: "26px",
                }}
              >
                Only selected offerings will be accessible.
                Deselecting all offerings removes access
                to this project.
              </p>

              {dirty && (
                <p
                  style={{
                    color: gold,
                    fontSize: "13px",
                    marginTop: "20px",
                  }}
                >
                  You have unsaved changes.
                </p>
              )}

              <button
                type="button"
                onClick={saveAccess}
                disabled={saving || !dirty}
                style={{
                  ...actionStyle,
                  marginTop: "28px",
                  opacity: saving || !dirty ? 0.45 : 1,
                  cursor:
                    saving || !dirty
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {saving
                  ? "Saving..."
                  : "Save Access Permissions →"}
              </button>
            </div>
          )}

          {notice && (
            <p
              role="status"
              style={{
                color: gold,
                fontSize: "14px",
                lineHeight: 1.7,
                marginTop: "30px",
              }}
            >
              {notice}
            </p>
          )}
        </div>
      </section>

      <footer className="admin-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}
