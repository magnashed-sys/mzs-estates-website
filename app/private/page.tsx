
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

type Project = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  status: string;
};

type Offering = {
  id: string;
  project_id: string;
  offering_type: string;
  title: string;
  status: string;
};

const offeringLabels: Record<string, string> = {
  sale: "Private Sale",
  rental: "Private Rental",
  investment: "Investment",
  financing: "Financing",
};

function SignOutButton() {
  return (
    <form action="/auth/signout" method="POST">
      <button
        type="submit"
        style={{
          background: "transparent",
          border: "1px solid #665a45",
          color: "#d5c09a",
          padding: "11px 18px",
          fontSize: "12px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        Sign Out →
      </button>
    </form>
  );
}

function PrivateHeader({
  role,
}: {
  role: string;
}) {
  return (
    <header className="private-header">
      <Link href="/" className="private-brand">
        MZS GROUP
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "22px",
        }}
      >
        <span>
          {role === "partner"
            ? "Partner Access"
            : "Private Client"}
        </span>

        <SignOutButton />
      </div>
    </header>
  );
}

function PrivateFooter() {
  return (
    <footer className="private-footer">
      Private. Independent. International.
    </footer>
  );
}

export default async function PrivatePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?role=client");
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role, is_active, full_name")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    redirect("/login?role=client");
  }

  if (profile.role === "admin") {
    redirect("/admin");
  }

  if (!["client", "partner"].includes(profile.role)) {
    redirect("/");
  }

  if (!profile.is_active) {
    return (
      <main className="private-page">
        <PrivateHeader role={profile.role} />

        <section className="private-content">
          <p className="eyebrow">
            Account Verification
          </p>

          <h1>Access pending.</h1>

          <p className="private-intro">
            Your account has not yet been activated
            by MZS Group. You will receive further
            information once your private access
            has been approved.
          </p>

          <Link href="/" className="opportunity-link">
            Return to MZS Group →
          </Link>
        </section>

        <PrivateFooter />
      </main>
    );
  }

  const { data: projectAccess, error: projectAccessError } =
    await supabase
      .from("project_access")
      .select("project_id")
      .eq("user_id", user.id);

  const { data: offeringAccess, error: offeringAccessError } =
    await supabase
      .from("offering_access")
      .select("offering_id")
      .eq("user_id", user.id);

  if (projectAccessError || offeringAccessError) {
    return (
      <main className="private-page">
        <PrivateHeader role={profile.role} />

        <section className="private-content">
          <p className="eyebrow">MZS GROUP</p>
          <h1>Unable to load access.</h1>

          <p className="private-intro">
            Your private opportunities are temporarily
            unavailable. Please try again later.
          </p>
        </section>

        <PrivateFooter />
      </main>
    );
  }

  const projectIds = [
    ...new Set(
      (projectAccess ?? []).map(
        (item) => item.project_id as string
      )
    ),
  ];

  const offeringIds = [
    ...new Set(
      (offeringAccess ?? []).map(
        (item) => item.offering_id as string
      )
    ),
  ];

  let projects: Project[] = [];
  let offerings: Offering[] = [];

  if (projectIds.length > 0) {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, slug, title, subtitle, location, status"
      )
      .in("id", projectIds)
      .eq("status", "active");

    if (error) {
      return (
        <main className="private-page">
          <PrivateHeader role={profile.role} />

          <section className="private-content">
            <h1>Unable to load projects.</h1>
            <p className="private-intro">
              Please try again later.
            </p>
          </section>

          <PrivateFooter />
        </main>
      );
    }

    projects = (data ?? []) as Project[];
  }

  if (offeringIds.length > 0 && projectIds.length > 0) {
    const { data, error } = await supabase
      .from("offerings")
      .select(
        "id, project_id, offering_type, title, status"
      )
      .in("id", offeringIds)
      .in("project_id", projectIds)
      .eq("status", "active");

    if (error) {
      return (
        <main className="private-page">
          <PrivateHeader role={profile.role} />

          <section className="private-content">
            <h1>Unable to load offerings.</h1>
            <p className="private-intro">
              Please try again later.
            </p>
          </section>

          <PrivateFooter />
        </main>
      );
    }

    offerings = (data ?? []) as Offering[];
  }

  const visibleProjects = projects
    .map((project) => ({
      ...project,
      offerings: offerings.filter(
        (offering) => offering.project_id === project.id
      ),
    }))
    .filter((project) => project.offerings.length > 0);

  const firstName =
    profile.full_name?.trim().split(/\s+/)[0] ||
    "Member";

  return (
    <main className="private-page">
      <PrivateHeader role={profile.role} />

      <section className="private-content">
        <p className="eyebrow">
          By invitation only
        </p>

        <h1>Welcome, {firstName}.</h1>

        <p className="private-intro">
          Your private MZS environment.
          Explore selected real estate and investment
          opportunities available exclusively
          to your account.
        </p>

        {visibleProjects.length === 0 ? (
          <article className="opportunity-card">
            <div>
              <p className="opportunity-location">
                Private Opportunities
              </p>

              <h2>No opportunities assigned yet.</h2>

              <p className="private-intro">
                Your relationship manager will
                notify you when new opportunities
                become available.
              </p>
            </div>
          </article>
        ) : (
          visibleProjects.map((project) => (
            <article
              className="opportunity-card"
              key={project.id}
            >
              <div>
                <p className="opportunity-location">
                  {project.location || "International"}
                </p>

                <h2>{project.title}</h2>

                {project.subtitle && (
                  <p className="private-intro">
                    {project.subtitle}
                  </p>
                )}

                <div className="offering-tags">
                  {project.offerings.map((offering) => (
                    <span key={offering.id}>
                      {offeringLabels[offering.offering_type] ??
                        offering.title}
                    </span>
                  ))}
                </div>
              </div>

              <span className="opportunity-link">
                Selected Opportunity
              </span>
            </article>
          ))
        )}
      </section>

      <PrivateFooter />
    </main>
  );
}
