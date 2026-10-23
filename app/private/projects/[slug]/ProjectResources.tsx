"use client";

import {useTranslations} from "next-intl";


import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import styles from "./projectResources.module.css";

type Editorial = { id: string; heading: string; body: string };
type Document = {
  id: string; title: string; description: string | null;
  file_path: string; category: string; mime_type: string; file_size_bytes: number;
};
const BUCKET = "mzs-private-project-documents";

export default function ProjectResources({ projectId, editorial }: {
  projectId: string; editorial: Editorial[];
}) {
  const t = useTranslations("ProjectUI");

  const [documents, setDocuments] = useState<Document[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    async function load() {
      // Access is evaluated by database RLS: project AND optionally offering grant.
      const { data, error: failure } = await createClient()
        .from("mzs_project_documents")
        .select("id,title,description,file_path,category,mime_type,file_size_bytes", { count: "exact" })
        .eq("project_id", projectId).eq("is_published", true)
        .order("position").order("created_at");
      if (!mounted) return;
      if (failure) {
        setStatus("error"); setError(t("p122")); return;
      }
      setDocuments((data || []) as Document[]);
      setStatus("ready");
    }
    void load();
    return () => { mounted = false; };
  }, [projectId, t]);

  async function openDocument(document: Document) {
    if (opening) return;
    // Open the tab directly from the click event, before requesting the
    // short-lived signed URL. Browsers otherwise tend to block async popups.
    const newTab = window.open("about:blank", "_blank");
    if (!newTab) {
      setError(t("p123"));
      return;
    }
    // Avoid giving the destination page access to the client dashboard.
    newTab.opener = null;
    setOpening(document.id); setError("");
    try {
      const { data, error: failure } = await createClient().storage
        .from(BUCKET).createSignedUrl(document.file_path, 60);
      if (failure || !data?.signedUrl) throw new Error(t("p124"));
      newTab.location.replace(data.signedUrl);
    } catch {
      newTab.close();
      setError(t("p125"));
    } finally {
      setOpening(null);
    }
  }

  if (editorial.length === 0 && status === "ready" && documents.length === 0) return null;
  return <section className={styles.section} aria-label={t("p126")}>
    {editorial.length > 0 && <div className={styles.group}>
      <p className={styles.eyebrow}>{t("p127")}</p>
      <h2>{t("p128")}</h2>
      <div className={styles.grid}>
        {editorial.map(block => <article key={block.id} className={styles.card}>
          <h3>{block.heading}</h3>
          <p className={styles.body}>{block.body}</p>
        </article>)}
      </div>
    </div>}
    {documents.length > 0 && <div className={styles.group}>
      <p className={styles.eyebrow}>{t("p129")}</p>
      <h2>{t("p130")}</h2>
      <p className={styles.description}>{t("p131")}</p>
      <div className={styles.grid}>
        {documents.map(doc => <article key={doc.id} className={styles.card}>
          <p className={styles.kicker}>{["presentation", "financial", "floorplan", "permit", "legal", "photo", "other"].includes(doc.category) ? t(`documentCategories.${doc.category}`) : doc.category} · {Math.ceil(doc.file_size_bytes / 1024)} KB</p>
          <h3>{doc.title}</h3>
          {doc.description && <p className={styles.body}>{doc.description}</p>}
          <button type="button" disabled={!!opening} onClick={()=>void openDocument(doc)} className={styles.button}>
            {opening === doc.id ? t("p133") : t("p134")}
          </button>
        </article>)}
      </div>
    </div>}
    {status === "error" && editorial.length === 0 && <p className={styles.description} role="status">{t("p135")}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
