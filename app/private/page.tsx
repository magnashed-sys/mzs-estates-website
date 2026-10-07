"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Opportunity = {
  projectId: string;
  title: string;
  location: string | null;
  offerings: string[];
};

function formatOffering(type: string) {
  const labels: Record<string, string> = {
    investment: "Investment Opportunity",
    financing: "Financing Opportunity",
    rental: "Private Rental",
    sale: "Private Sale",
  };

  return labels[type] ?? type;
}

export default function PrivatePage() {
  const router = useRouter();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPrivateEnvironment() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?role=client");
        return;
      }

      const { data: projectAccess, error: projectError } = await supabase
        .from("project_access")
        .select(`
          project_id,
          projects (
            id,
            title,
            location
          )
        `)
        .eq("user_id", user.id);

      if (projectError) {
        console.error(projectError);
        setLoading(false);
        return;
      }

      const { data: offeringAccess, error: offeringError } = await supabase
        .from("offering_access")
        .select(`
          offering_id,
          offerings (
            id,
            project_id,
            offering_type
          )
        `)
        .eq("user_id", user.id);

      if (offeringError) {
        console.error(offeringError);
        setLoading(false);
        return;
      }

      const result: Opportunity[] = (projectAccess ?? []).map((access: any) => {
        const project = access.projects;

        const offerings = (offeringAccess ?? [])
          .map((item: any) => item.offerings)
          .filter(
            (offering: any) =>
              offering && offering.project_id === access.project_id
          )
          .map((offering: any) =>
            formatOffering(offering.offering_type)
          );

        return {
          projectId: access.project_id,
          title: project?.title ?? "Private Opportunity",
          location: project?.location ?? null,
          offerings,
        };
      });

      setOpportunities(result);
      setLoading(false);
    }

    loadPrivateEnvironment();
  }, [router]);

  return (
    <main className="private-page">
      <header className="private-header">
        <Link href="/" className="private-brand">
          MZS GROUP
        </Link>

        <span>Private Access</span>
      </header>

      <section className="private-content">
        <p className="eyebrow">Selected for you</p>

        <h1>Your private opportunities.</h1>

        <p className="private-intro">
          A curated selection of opportunities available exclusively
          through MZS Group.
        </p>

        {loading && (
          <p className="private-intro">Loading your private environment...</p>
        )}

        {!loading && opportunities.length === 0 && (
          <p className="private-intro">
            No opportunities are currently assigned to your account.
          </p>
        )}

        {!loading &&
          opportunities.map((project) => (
            <div className="opportunity-card" key={project.projectId}>
              <div>
                {project.location && (
                  <p className="opportunity-location">
                    {project.location}
                  </p>
                )}

                <h2>{project.title}</h2>

                <div className="offering-tags">
                  {project.offerings.map((offering) => (
                    <span key={offering}>{offering}</span>
                  ))}
                </div>
              </div>

              <span className="opportunity-link">
                View opportunity →
              </span>
            </div>
          ))}
      </section>

      <footer className="private-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}
