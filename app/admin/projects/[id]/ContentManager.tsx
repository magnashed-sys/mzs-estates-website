"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "../../../../lib/supabase/client";
import type { TextBlock } from "./project-model";
import styles from "./projectCockpit.module.css";

const textOf = (block: TextBlock) => ({
  heading: typeof block.content?.heading === "string" ? block.content.heading : "",
  body: typeof block.content?.body === "string" ? block.content.body : "",
});
type Props = { projectId: string; blocks: TextBlock[]; onReload: () => Promise<void> };

export default function ContentManager({ projectId, blocks, onReload }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [position, setPosition] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = blocks.find(block => block.id === editing);

  function start(block?: TextBlock) {
    setEditing(block?.id || null);
    setTitle(block ? textOf(block).heading : "");
    setBody(block ? textOf(block).body : "");
    setPosition(String(block?.position ?? (blocks.length + 1) * 100));
    setError(""); setNotice("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (title.trim().length < 3 || title.trim().length > 140 ||
        body.trim().length < 10 || body.length > 6000 ||
        !/^\d{1,5}$/.test(position) || Number(position) > 10000) {
      setError("Use a heading of 3–140 characters, body of 10–6,000 characters and order 0–10,000.");
      return;
    }
    if (selected?.is_visible && !window.confirm("This text block is currently published. Saving will update it for existing authorized clients immediately. Continue?")) return;
    setBusy(true); setError(""); setNotice("");
    const client = createClient();
    try {
      const fields = { content: { heading: title.trim(), body: body.trim() },
        position: Number(position), updated_at: new Date().toISOString() };
      if (selected) {
        const { data, error: failure } = await client.from("project_content")
          .update(fields).eq("id", selected.id).eq("project_id", projectId)
          .eq("block_type", "text").eq("updated_at", selected.updated_at)
          .select("id").maybeSingle();
        if (failure || !data) throw new Error("Could not confirm update. Refresh and check this block.");
      } else {
        const { error: failure } = await client.from("project_content")
          .insert({ ...fields, project_id: projectId, block_type: "text", is_visible: false });
        if (failure) throw failure;
      }
      await onReload();
      start();
      setNotice("Project text saved. New blocks remain unpublished until you publish them.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save project text.");
    } finally { setBusy(false); }
  }

  async function changePublished(block: TextBlock) {
    if (busy) return;
    const next = !block.is_visible;
    if (!window.confirm(next
      ? "Publish this project text? It will appear on the private project presentation for authorized members."
      : "Unpublish this project text? Members will no longer see it.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: failure } = await createClient().from("project_content")
        .update({ is_visible: next, updated_at: new Date().toISOString() })
        .eq("id", block.id).eq("project_id", projectId).eq("block_type", "text")
        .eq("updated_at", block.updated_at).select("id,is_visible").maybeSingle();
      if (failure || !data || data.is_visible !== next) throw new Error("Publication state could not be verified.");
      await onReload(); start();
      setNotice(next ? "Project text published." : "Project text unpublished.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change publication.");
    } finally { setBusy(false); }
  }

  async function remove(block: TextBlock) {
    if (busy || block.is_visible) return;
    if (!window.confirm("Permanently remove this UNPUBLISHED text block?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: failure } = await createClient().from("project_content")
        .delete().eq("id", block.id).eq("project_id", projectId)
        .eq("block_type", "text").eq("is_visible", false)
        .select("id").maybeSingle();
      if (failure || !data) throw new Error("Block deletion could not be verified.");
      await onReload(); start();
      setNotice("Unpublished block removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove block.");
    } finally { setBusy(false); }
  }

  return <div className={styles.stack}>
    <p className={styles.note}>Add editorial text to the private presentation without editing website code. New blocks start as drafts. Published text appears after the existing project presentation; existing galleries and rental calendars remain unchanged.</p>
    <section className={styles.panel}>
      <div className={styles.panelTitle}><h2>Project text blocks.</h2><span>{blocks.filter(x=>x.is_visible).length} published / {blocks.length} total</span></div>
      {blocks.length === 0 ? <p className={styles.empty}>No editable project text has been created yet.</p> :
        <div className={styles.stack}>
          {blocks.map(block => <article className={styles.item} key={block.id}>
            <div className={styles.itemHeading}><div><span className={styles.kicker}>Order {block.position}</span>
              <h3>{textOf(block).heading || "Untitled text block"}</h3></div>
              <span className={styles.pill}>{block.is_visible ? "Published" : "Draft"}</span>
            </div>
            <p className={styles.preview}>{textOf(block).body}</p>
            <div className={styles.actions}>
              <button type="button" className="admin-button" disabled={busy} onClick={()=>start(block)}>Edit</button>
              <button type="button" className="admin-button" disabled={busy} onClick={()=>void changePublished(block)}>{block.is_visible ? "Unpublish" : "Publish"}</button>
              {!block.is_visible && <button type="button" className="admin-button" disabled={busy} onClick={()=>void remove(block)}>Delete draft</button>}
            </div>
          </article>)}
        </div>}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelTitle}><h2>{selected ? "Edit project text." : "Add project text."}</h2>
        {selected && <button type="button" className="admin-button" disabled={busy} onClick={()=>start()}>Cancel editing</button>}
      </div>
      <form className={styles.form} onSubmit={save}>
        <label>Heading
          <input value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} required disabled={busy} placeholder="A closer look at the opportunity" />
        </label>
        <label>Text (plain text, no HTML)
          <textarea rows={7} value={body} onChange={e=>setBody(e.target.value)} maxLength={6000} required disabled={busy} placeholder="Describe the project, plans or current milestone…" />
        </label>
        <label>Display order
          <input type="number" min={0} max={10000} step={1} value={position} onChange={e=>setPosition(e.target.value)} disabled={busy} />
        </label>
        <button type="submit" disabled={busy} className="admin-button admin-button-primary">{busy ? "Saving…" : selected ? "Save text changes" : "Save as draft"}</button>
      </form>
    </section>
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {error && <p className={styles.failure} role="alert">{error}</p>}
  </div>;
}
