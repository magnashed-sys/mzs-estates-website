"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "../../../../lib/supabase/client";
import type { Offering, ProjectDocument } from "./project-model";
import { offeringNames } from "./project-model";
import styles from "./projectCockpit.module.css";

const BUCKET = "mzs-private-project-documents";
const LIMIT = 20 * 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const categories = ["presentation", "financial", "floorplan", "permit", "legal", "photo", "other"];

type Props = {
  projectId: string; offerings: Offering[]; documents: ProjectDocument[];
  onReload: () => Promise<void>;
};

export default function DocumentManager({ projectId, offerings, documents, onReload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("presentation");
  const [offeringId, setOfferingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setNotice("");
    const extension = file?.name.split(".").pop()?.toLowerCase() || "";
    const mime = mimeByExtension[extension];
    if (!file || !mime || !file.size || file.size > LIMIT ||
        (file.type && file.type !== mime) || title.trim().length < 2 ||
        title.trim().length > 160 || description.length > 2000 ||
        (offeringId && !offerings.some(offering => offering.id === offeringId))) {
      setError("Select a valid PDF, image or Office file (up to 20 MB), a title of 2–160 characters, and a valid project offering.");
      return;
    }
    if (!window.confirm("Upload this file to PRIVATE project storage as a DRAFT? It will not be visible to clients until you publish it.")) return;
    setBusy(true);
    const client = createClient();
    const safeExtension = extension === "jpeg" ? "jpg" : extension;
    const path = projectId + "/" + crypto.randomUUID() + "." + safeExtension;
    let uploaded = false;
    try {
      const { error: storageError } = await client.storage.from(BUCKET)
        .upload(path, file, { contentType: mime, cacheControl: "0", upsert: false });
      if (storageError) throw storageError;
      uploaded = true;
      const { error: insertError } = await client.from("mzs_project_documents").insert({
        project_id: projectId,
        offering_id: offeringId || null,
        file_path: path,
        title: title.trim(),
        description: description.trim() || null,
        category,
        mime_type: mime,
        file_size_bytes: file.size,
        is_published: false,
      });
      if (insertError) throw insertError;
      uploaded = false;
      setFile(null); setTitle(""); setDescription(""); setOfferingId("");
      const chooser = document.getElementById("mzs-project-doc-file") as HTMLInputElement | null;
      if (chooser) chooser.value = "";
      await onReload();
      setNotice("File securely uploaded as a DRAFT. Publish explicitly when ready.");
    } catch (cause) {
      if (uploaded) {
        await client.storage.from(BUCKET).remove([path]).catch(() => {});
      }
      setError(cause instanceof Error ? cause.message : "File upload could not be verified.");
    } finally { setBusy(false); }
  }

  async function changePublication(doc: ProjectDocument) {
    if (busy) return;
    const publish = !doc.is_published;
    const scope = doc.offering_id
      ? offerings.find(item => item.id === doc.offering_id)?.title || "a specific offering"
      : "all authorized members of this project";
    if (!window.confirm(publish
      ? "Publish this PRIVATE document for " + scope + "? The file can only be opened by an authorized member."
      : "Unpublish this document immediately? Existing short-lived links may remain valid until expiry.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: failure } = await createClient()
        .from("mzs_project_documents")
        .update({ is_published: publish })
        .eq("id", doc.id).eq("project_id", projectId)
        .eq("is_published", doc.is_published)
        .select("id,is_published").maybeSingle();
      if (failure || !data || data.is_published !== publish) throw new Error("The publication state could not be confirmed.");
      await onReload();
      setNotice(publish ? "Document published to its selected audience." : "Document is no longer listed for members.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication could not be confirmed.");
    } finally { setBusy(false); }
  }

  async function openPrivate(doc: ProjectDocument) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: failure } = await createClient().storage.from(BUCKET)
        .createSignedUrl(doc.file_path, 60);
      if (failure || !data?.signedUrl) throw new Error("Secure access to this file could not be confirmed.");
      window.location.assign(data.signedUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open document.");
      setBusy(false);
    }
  }

  async function remove(doc: ProjectDocument) {
    if (busy) return;
    if (!window.confirm("Permanently delete this PRIVATE project file? This cannot be undone. Its published access will be disabled first.")) return;
    setBusy(true); setError(""); setNotice("");
    const client = createClient();
    try {
      if (doc.is_published) {
        const { error: unpublishError } = await client.from("mzs_project_documents")
          .update({ is_published: false }).eq("id", doc.id).eq("project_id", projectId);
        if (unpublishError) throw unpublishError;
      }
      const { error: fileError } = await client.storage.from(BUCKET).remove([doc.file_path]);
      if (fileError) throw fileError;
      const { data, error: dbError } = await client.from("mzs_project_documents")
        .delete().eq("id", doc.id).eq("project_id", projectId).select("id").maybeSingle();
      if (dbError || !data) throw new Error("Storage was removed, but the database record needs administrator review. Refresh before retrying.");
      await onReload();
      setNotice("Private file and document record removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document removal could not be confirmed. Refresh before another action.");
    } finally { setBusy(false); }
  }

  return <div className={styles.stack}>
    <p className={styles.note}>All documents are stored in a private bucket with project and, optionally, offering-specific access rules. New files are drafts. Publishing never grants project access to new members.</p>
    <section className={styles.panel}>
      <div className={styles.panelTitle}><h2>Private project documents.</h2>
        <span>{documents.filter(x=>x.is_published).length} published / {documents.length} total</span></div>
      {documents.length === 0 ? <p className={styles.empty}>No private project documents have been uploaded.</p> :
        <div className={styles.stack}>
          {documents.map(doc => <article key={doc.id} className={styles.item}>
            <div className={styles.itemHeading}>
              <div><span className={styles.kicker}>{doc.category} · {Math.ceil(doc.file_size_bytes / 1024)} KB</span>
                <h3>{doc.title}</h3></div>
              <span className={styles.pill}>{doc.is_published ? "Published" : "Draft"}</span>
            </div>
            {doc.description && <p className={styles.preview}>{doc.description}</p>}
            <p className={styles.note}>Audience: {doc.offering_id
              ? offerings.find(o=>o.id === doc.offering_id)?.title || "Selected offering only"
              : "All members authorized for this project"}</p>
            <div className={styles.actions}>
              <button className="admin-button" type="button" disabled={busy} onClick={()=>void openPrivate(doc)}>Open privately</button>
              <button className="admin-button" type="button" disabled={busy} onClick={()=>void changePublication(doc)}>{doc.is_published ? "Unpublish" : "Publish"}</button>
              <button className="admin-button" type="button" disabled={busy} onClick={()=>void remove(doc)}>Delete</button>
            </div>
          </article>)}
        </div>}
    </section>
    <section className={styles.panel}>
      <h2>Upload a private document.</h2>
      <form className={styles.form} onSubmit={upload}>
        <label>File — PDF, PNG, JPEG, WebP, DOCX or XLSX (maximum 20 MB)
          <input id="mzs-project-doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" disabled={busy}
            onChange={event=>setFile(event.target.files?.[0] || null)} required />
        </label>
        <label>Document title
          <input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={160} disabled={busy} />
        </label>
        <label>Description (optional)
          <textarea rows={3} value={description} maxLength={2000} onChange={e=>setDescription(e.target.value)} disabled={busy} />
        </label>
        <div className={styles.formColumns}>
          <label>Document category
            <select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy}>
              {categories.map(item=><option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}
            </select>
          </label>
          <label>Private audience
            <select value={offeringId} onChange={e=>setOfferingId(e.target.value)} disabled={busy}>
              <option value="">All members granted project access</option>
              {offerings.map(offering=><option key={offering.id} value={offering.id}>
                {offeringNames[offering.offering_type]} — {offering.title || "Untitled"}
              </option>)}
            </select>
          </label>
        </div>
        <button className="admin-button admin-button-primary" disabled={busy} type="submit">
          {busy ? "Uploading…" : "Upload private draft"}
        </button>
      </form>
    </section>
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {error && <p className={styles.failure} role="alert">{error}</p>}
  </div>;
}
