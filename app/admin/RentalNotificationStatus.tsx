"use client";
import {useAdminI18n} from '../../lib/admin/i18n';

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; booking_id: string; kind: string; status: string; attempts: number;
  last_error: string | null; created_at: string; recipient_email: string | null };
const labels: Record<string, string> = {
  pending: "Queued", sending: "Sending", retry: "Queued for retry", accepted: "Accepted by mail server",
  captured: "Staging capture — not sent", failed: "Needs attention", uncertain: "Delivery unknown — check mail logs",
  superseded: "Replaced by newer details",
};

export default function RentalNotificationStatus({ refreshKey }: { refreshKey: string }) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const [items, setItems] = useState<Item[]>([]);
  const [capture, setCapture] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/rental/notifications", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Notification overview unavailable");
      setItems(body.notifications); setCapture(body.capture); setMessage("");
    } catch { setMessage("Notification status is unavailable. Refresh before retrying a booking action."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);
  async function action(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rental/notifications", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Delivery action could not be verified");
      await refresh();
    } catch { setMessage("Outcome unavailable. Refresh and check the notification before trying again."); }
    finally { setBusy(false); }
  }
  function resolve(item: Item, decision: "accepted" | "retry") {
    const reason = window.prompt(decision === "accepted"
      ? "Only continue after mail-server logs confirm this exact notification was accepted. Record your verification:"
      : "Only continue after confirming this exact notification was NOT accepted by the mail server and correcting the cause. Record your verification:");
    if (!reason || reason.trim().length < 10) return;
    void action({ action: "resolve", id: item.id, decision, reason, verified: true });
  }
  return <details style={{ marginTop: 30, border: "1px solid #514839", padding: 20 }}>
    <summary style={{ cursor: "pointer", color: "#d5c09a" }}>{adminT("Client notification status")}</summary>
    <p style={{ color: "#cfc5b7", lineHeight: 1.7 }}>{adminT("Relevant changes and cancellations are queued automatically. Internal notes and cancellation reasons are never included. Mail-server acceptance does not confirm inbox delivery.")}{capture && adminT(" Staging captures messages without sending email.")}</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button className="admin-button" disabled={busy} onClick={() => void refresh()}>{adminT("Refresh notifications")}</button>
      <button className="admin-button" disabled={busy} onClick={() => void action({ action: "dispatch" })}>{adminT("Process next queued email")}</button>
    </div>
    {message && <p role="status">{adminT(message)}</p>}
    {!items.length && !message && <p>{adminT("No change notifications yet.")}</p>}
    {items.map(item => <article key={item.id} style={{ padding: "18px 0", borderBottom: "1px solid #514839", overflowWrap: "anywhere" }}>
      <strong>{item.kind === "cancelled" ? adminT("Cancellation") : adminT("Reservation update")} — {labels[item.status] || adminT(item.status)}</strong>
      <p>{adminT("Booking")} {item.booking_id}<br />{adminT("Recipient:")} {item.recipient_email || adminT("Requires review")}<br />
        {new Date(item.created_at).toLocaleString(adminLocale, { timeZone: "Europe/Madrid" })}  {adminT("· Attempts:")} {item.attempts}</p>
      {item.last_error && <p>{adminT("Check:")} {adminT(item.last_error.replaceAll("_", " "))}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {capture && <a href={`/api/rental/notifications?preview=${item.id}`} target="_blank" rel="noopener noreferrer">{adminT("Preview email")}</a>}
        {["failed", "uncertain"].includes(item.status) && <>
          <button className="admin-button" disabled={busy} onClick={() => resolve(item, "accepted")}>{adminT("Verified accepted")}</button>
          <button className="admin-button" disabled={busy} onClick={() => resolve(item, "retry")}>{adminT("Verified not sent — queue again")}</button>
        </>}
      </div>
    </article>)}
    <p style={{ color: "#cfc5b7", fontSize: 13 }}>{adminT("Showing the latest 50 notifications. Uncertain deliveries require verification before another send.")}</p>
  </details>;
}
