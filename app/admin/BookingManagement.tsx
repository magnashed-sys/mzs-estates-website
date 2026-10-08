"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Booking = {
  id: string;
  project_id: string;
  user_id: string | null;
  check_in: string;
  check_out: string;
  guest_count: number | null;
  preferred_check_in: string | null;
  preferred_check_out: string | null;
  pool_heating_requested: boolean;
  status: string;
  is_test: boolean;
  quoted_total_eur: number | null;
  guest_notes: string | null;
  admin_notes: string | null;
  created_at: string;
};
type Person = { id: string; full_name: string | null; email: string };
type Property = { id: string; title: string };
type Filter = "all" | "requested" | "reviewed";

const gold = "#d5c09a";
const muted = "#aaa398";
const border = "#514839";
const action: React.CSSProperties = {
  padding: "12px 18px", fontSize: 11, letterSpacing: ".09em",
  border: `1px solid ${gold}`, cursor: "pointer",
};
const euro = (amount: number | null) => amount === null
  ? "Price unavailable"
  : new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(amount));
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const time = (value: string | null) => value ? value.slice(0, 5) : "Not specified";

export default function BookingManagement() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const [b, p, r] = await Promise.all([
      supabase.from("rental_bookings")
        .select("id,project_id,user_id,check_in,check_out,guest_count,preferred_check_in,preferred_check_out,pool_heating_requested,status,is_test,quoted_total_eur,guest_notes,admin_notes,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("projects").select("id,title"),
    ]);
    if (b.error || p.error || r.error) {
      setError("Unable to load bookings. Check administrator access and try again.");
    } else {
      setBookings((b.data ?? []) as Booking[]);
      setPeople((p.data ?? []) as Person[]);
      setProperties((r.data ?? []) as Property[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function review(booking: Booking, decision: "approved" | "declined") {
    if (busy || booking.status !== "requested") return;
    const label = booking.is_test ? "TEST request (no dates will be blocked)" : "REAL booking (dates will be reserved if approved)";
    if (!window.confirm(`${decision === "approved" ? "Approve" : "Decline"} ${label}?\n${date(booking.check_in)} – ${date(booking.check_out)}`)) return;
    setBusy(booking.id);
    setNotice("");
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("review_rental_booking", {
      p_booking_id: booking.id, p_decision: decision, p_admin_notes: null,
    });
    if (rpcError || typeof data !== "string") {
      setNotice(`Review failed: ${rpcError?.message ?? "Unknown error"}`);
    } else {
      setNotice(`Booking status updated: ${data}.`);
    }
    await reload();
    setBusy(null);
  }

  async function removeTest(booking: Booking) {
    if (busy || !booking.is_test) return;
    if (!window.confirm(`Permanently DELETE this TEST booking?\n${date(booking.check_in)} – ${date(booking.check_out)}\nThis cannot be undone.`)) return;
    setBusy(booking.id);
    setNotice("");
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("delete_test_rental_booking", { p_booking_id: booking.id });
    setNotice(rpcError || data !== true
      ? `Deletion failed: ${rpcError?.message ?? "Not confirmed"}`
      : "Test booking permanently deleted.");
    await reload();
    setBusy(null);
  }

  const visible = bookings.filter(b => filter === "all" ||
    (filter === "requested" ? b.status === "requested" : b.status !== "requested"));
  const pending = bookings.filter(b => b.status === "requested").length;

  return <div style={{ color: "#eeeae2" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
      <p style={{ color: muted, margin: 0 }}>{pending} pending · {bookings.length} total requests</p>
      <button type="button" style={{ ...action, background: "transparent", color: gold }} onClick={() => void reload()} disabled={loading || !!busy}>Refresh bookings</button>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
      {([ ["all", "All"], ["requested", "Pending"], ["reviewed", "Reviewed"] ] as const).map(([key, label]) =>
        <button type="button" key={key} onClick={() => setFilter(key)}
          style={{ ...action, background: filter === key ? gold : "transparent", color: filter === key ? "#10100d" : gold }}>{label}</button>
      )}
    </div>
    {notice && <p role="status" style={{ color: gold, lineHeight: 1.7 }}>{notice}</p>}
    {loading && <p style={{ color: muted }}>Loading booking requests...</p>}
    {error && <p role="alert" style={{ color: "#e3a995" }}>{error}</p>}
    {!loading && !error && visible.length === 0 && <p style={{ color: muted }}>No bookings in this category.</p>}
    {!loading && !error && <div style={{ display: "grid", gap: 18 }}>
      {visible.map(b => {
        const person = people.find(p => p.id === b.user_id);
        const property = properties.find(p => p.id === b.project_id);
        return <article key={b.id} style={{ padding: "clamp(18px,3vw,30px)", border: `1px solid ${border}`, background: "#151411" }}>
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 27, fontWeight: 400, margin: "0 0 8px" }}>{property?.title ?? "Property unavailable"}</h3>
              <p style={{ color: muted, margin: 0 }}>{person?.full_name || "Unnamed client"} · {person?.email || "Account unavailable"}</p>
            </div>
            <span style={{ color: gold, border: `1px solid ${border}`, padding: "8px 11px", fontSize: 11, letterSpacing: ".08em" }}>{b.is_test ? "TEST · " : "LIVE · "}{b.status.toUpperCase().replaceAll("_", " ")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 20, marginTop: 25 }}>
            <div><small style={{ color: muted }}>Check-in</small><p>{date(b.check_in)}</p></div>
            <div><small style={{ color: muted }}>Check-out</small><p>{date(b.check_out)}</p></div>
            <div><small style={{ color: muted }}>Guests</small><p>{b.guest_count ?? "—"}</p></div>
            <div><small style={{ color: muted }}>Quoted total</small><p>{euro(b.quoted_total_eur)}</p></div>
            <div><small style={{ color: muted }}>Preferred arrival</small><p>{time(b.preferred_check_in)}</p></div>
            <div><small style={{ color: muted }}>Preferred departure</small><p>{time(b.preferred_check_out)}</p></div>
            <div><small style={{ color: muted }}>Pool heating</small><p>{b.pool_heating_requested ? "Requested" : "No"}</p></div>
            <div><small style={{ color: muted }}>Received</small><p>{new Date(b.created_at).toLocaleString("en-GB")}</p></div>
          </div>
          {b.guest_notes && <p style={{ color: muted, lineHeight: 1.7 }}>Guest notes: {b.guest_notes}</p>}
          {b.admin_notes && <p style={{ color: muted, lineHeight: 1.7 }}>Admin notes: {b.admin_notes}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
            {b.status === "requested" && <>
              <button type="button" disabled={!!busy} onClick={() => void review(b, "approved")}
                style={{ ...action, background: gold, color: "#0b0b0a" }}>{busy === b.id ? "Processing..." : b.is_test ? "Approve test" : "Confirm booking"}</button>
              <button type="button" disabled={!!busy} onClick={() => void review(b, "declined")}
                style={{ ...action, background: "transparent", color: gold }}>Decline</button>
            </>}
            {b.is_test && <button type="button" disabled={!!busy} onClick={() => void removeTest(b)}
              style={{ ...action, background: "transparent", borderColor: "#b78578", color: "#e3a995" }}>Delete test booking</button>}
          </div>
        </article>;
      })}
    </div>}
    <p style={{ color: muted, fontSize: 12, marginTop: 25, lineHeight: 1.7 }}>Test approvals never block dates. Live approvals confirm reservations and block the relevant nights. Deletion is restricted to test records and requires confirmation.</p>
  </div>;
}
