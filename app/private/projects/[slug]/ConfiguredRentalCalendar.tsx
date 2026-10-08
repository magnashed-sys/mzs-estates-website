"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

type Configuration = {
  id: string;
  code: string;
  title: string;
  bedrooms: number;
  bathrooms: number;
  maximum_guests: number;
  minimum_nights: number;
  nightly_rate_eur: number;
};
type Period = { check_in: string; check_out: string };
type CalendarResponse = { configurations: Configuration[]; unavailable: Period[] };
const gold = "#d5c09a";
const muted = "#aaa59b";
const border = "#403a30";
const dateFromKey = (key: string) => new Date(`${key}T12:00:00Z`);
const keyFromDate = (date: Date) => date.toISOString().slice(0, 10);
const nightsBetween = (a: string, b: string) => Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / 86400000);
const euro = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const madridToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function ConfiguredRentalCalendar({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [month, setMonth] = useState(() => {
    const today = dateFromKey(madridToday());
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  });
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: response, error: fetchError } = await createClient().rpc("get_configured_rental_calendar", { p_project_id: projectId });
      if (!active) return;
      if (fetchError || !response) setError("Availability is temporarily unavailable.");
      else {
        const result = response as CalendarResponse;
        setData(result);
        setSelectedId(result.configurations[0]?.id ?? "");
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [projectId]);

  const config = data?.configurations.find((item) => item.id === selectedId);
  const blocked = data?.unavailable ?? [];
  const today = madridToday();
  const unavailable = (day: string) => blocked.some((period) => day >= period.check_in && day < period.check_out);
  const rangeAvailable = (start: string, end: string) => !blocked.some((period) => start < period.check_out && end > period.check_in);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const total = nights * Number(config?.nightly_rate_eur ?? 0);

  function selectDay(day: string) {
    if (!config || day < today) return;
    setMessage("");
    setSubmitted(false);
    if (!checkIn || checkOut || day <= checkIn) {
      if (unavailable(day)) return;
      setCheckIn(day);
      setCheckOut(null);
      return;
    }
    if (nightsBetween(checkIn, day) < config.minimum_nights) {
      setMessage(`Minimum stay is ${config.minimum_nights} nights.`);
      return;
    }
    if (!rangeAvailable(checkIn, day)) {
      setMessage("The selected dates overlap an unavailable period.");
      return;
    }
    setCheckOut(day);
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !checkIn || !checkOut || submitting || submitted) return;
    if (nights < config.minimum_nights || !rangeAvailable(checkIn, checkOut) || guests < 1 || guests > config.maximum_guests) {
      setMessage("Please review your dates and guest count.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const { data: bookingId, error: submitError } = await createClient().rpc("request_configured_rental_booking", {
        p_project_id: projectId,
        p_configuration_id: config.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_guest_count: guests,
        p_preferred_check_in: arrival || null,
        p_preferred_check_out: departure || null,
        p_guest_notes: notes.trim() || null,
      });
      if (submitError || !bookingId) throw new Error("Booking submission failed");
      setSubmitted(true);
      setMessage("Your test booking request was submitted successfully. No dates have been reserved.");
    } catch {
      setMessage("Unable to submit the request. Please check availability and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: muted }}>Loading availability...</p>;
  if (error || !data?.configurations.length) return <p style={{ color: muted }}>{error || "No rental configurations available."}</p>;

  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const offset = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) => {
    const day = i - offset + 1;
    return day < 1 ? null : keyFromDate(new Date(Date.UTC(year, monthIndex, day)));
  });
  const navButton: React.CSSProperties = { background: "transparent", border: `1px solid ${border}`, color: gold, padding: "10px 15px", cursor: "pointer" };
  const inputStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", background: "#0b0b0a", border: `1px solid ${border}`, color: "#eeeae2", padding: 12, marginTop: 8, fontSize: 15 };

  return (
    <section style={{ background: "#151411", color: "#eeeae2", border: `1px solid ${border}`, padding: "clamp(24px,5vw,65px)" }}>
      <p style={{ color: gold, letterSpacing: ".2em", fontSize: 12 }}>MARINA BOTAFOCH · PRIVATE RENTAL</p>
      <h2 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: "clamp(34px,5vw,56px)", margin: "14px 0" }}>Plan your Ibiza stay.</h2>
      <p style={{ color: muted, lineHeight: 1.7 }}>Choose your preferred apartment configuration. Both options share the same availability.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 14, margin: "30px 0 42px" }}>
        {data.configurations.map((item) => (
          <button key={item.id} type="button" aria-pressed={item.id === selectedId} onClick={() => { setSelectedId(item.id); setGuests((n) => Math.min(n, item.maximum_guests)); setSubmitted(false); setMessage(""); }} style={{ textAlign: "left", padding: 23, border: `2px solid ${item.id === selectedId ? gold : border}`, background: item.id === selectedId ? "#2b261e" : "#11100e", color: "#eeeae2", cursor: "pointer" }}>
            <span style={{ color: gold, fontSize: 12, letterSpacing: ".12em" }}>{item.bedrooms} BEDROOMS · {item.bathrooms} BATHROOM{item.bathrooms > 1 ? "S" : ""}</span>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 36, margin: "14px 0 6px" }}>{euro(Number(item.nightly_rate_eur))}</div>
            <span style={{ color: muted, fontSize: 13 }}>Per night · up to {item.maximum_guests} guests</span>
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 44 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <button type="button" style={navButton} disabled={keyFromDate(month).slice(0, 7) <= today.slice(0, 7)} onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))}>←</button>
            <span style={{ fontFamily: "Georgia,serif", fontSize: 22 }}>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            <button type="button" style={navButton} onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))}>→</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 5 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span key={i} style={{ textAlign: "center", color: gold, fontSize: 12, padding: "8px 0" }}>{day}</span>)}
            {cells.map((day, i) => {
              if (!day) return <span key={`empty-${i}`} />;
              const blockedDay = unavailable(day);
              const past = day < today;
              const selected = day === checkIn || day === checkOut;
              const between = Boolean(checkIn && checkOut && day > checkIn && day < checkOut);
              // A blocked day's start may still be a valid checkout date.
              const checkoutOnBlockedStart = Boolean(checkIn && !checkOut && day > checkIn && blocked.some((p) => p.check_in === day));
              const disabled = past || (blockedDay && !checkoutOnBlockedStart);
              return <button key={day} type="button" disabled={disabled} onClick={() => selectDay(day)} aria-label={`${day}${blockedDay ? ", unavailable for overnight stays" : ""}`} aria-pressed={selected} style={{ minHeight: 45, border: `1px solid ${border}`, background: selected ? gold : blockedDay ? "#30251f" : between ? "#51402b" : "transparent", color: selected ? "#111" : disabled ? "#716b63" : "#eeeae2", cursor: disabled ? "not-allowed" : "pointer", opacity: past ? .5 : 1 }}>{Number(day.slice(-2))}</button>;
            })}
          </div>
          <p style={{ color: muted, fontSize: 12, lineHeight: 1.8 }}>Available · Selected in gold · Unavailable in dark brown. Existing reservations block both configurations.</p>
        </div>
        <div>
          <p style={{ color: gold, fontSize: 12, letterSpacing: ".15em" }}>YOUR SELECTION</p>
          <p style={{ color: muted, lineHeight: 1.8 }}>Check-in: <strong style={{ color: "#eeeae2" }}>{checkIn ?? "Select a date"}</strong><br />Check-out: <strong style={{ color: "#eeeae2" }}>{checkOut ?? "Select a date"}</strong></p>
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: 20, marginTop: 20 }}>
            <p style={{ color: muted }}>{nights} nights × {euro(Number(config?.nightly_rate_eur ?? 0))}</p>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 42 }}>{euro(total)}</div>
            <p style={{ color: muted, fontSize: 12 }}>Estimated total · Minimum {config?.minimum_nights ?? 7} nights</p>
          </div>
          {checkIn && checkOut && config && !submitted && (
            <form onSubmit={submitBooking} style={{ display: "grid", gap: 18, borderTop: `1px solid ${border}`, paddingTop: 24, marginTop: 26 }}>
              <p style={{ color: gold, letterSpacing: ".15em", fontSize: 12 }}>REQUEST YOUR STAY · TEST MODE</p>
              <label>Number of guests<input style={inputStyle} type="number" min={1} max={config.maximum_guests} required value={guests} onChange={(e) => setGuests(Number(e.target.value))} /></label>
              <label>Preferred check-in time (optional)<input style={inputStyle} type="time" value={arrival} onChange={(e) => setArrival(e.target.value)} /></label>
              <label>Preferred check-out time (optional)<input style={inputStyle} type="time" value={departure} onChange={(e) => setDeparture(e.target.value)} /></label>
              <label>Special requests (optional)<textarea style={inputStyle} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <button type="submit" disabled={submitting} style={{ background: gold, color: "#111", border: 0, padding: 17, cursor: submitting ? "wait" : "pointer", letterSpacing: ".1em" }}>{submitting ? "SUBMITTING..." : "SUBMIT TEST BOOKING REQUEST →"}</button>
              <p style={{ color: muted, fontSize: 12 }}>Test requests do not reserve dates. MZS approval is required for real bookings.</p>
            </form>
          )}
          {message && <p role="status" style={{ color: submitted ? gold : "#e2a78d", lineHeight: 1.7 }}>{message}</p>}
        </div>
      </div>
    </section>
  );
}
