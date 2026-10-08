
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

type Settings = {
  nightly_rate_eur: number;
  minimum_nights: number;
  maximum_guests: number;
  pool_heating_available: boolean;
  pool_heating_surcharge_eur: number | null;
};

type Period = {
  check_in: string;
  check_out: string;
};

type CalendarData = {
  settings: Settings;
  unavailable: Period[];
};

type Props = {
  projectId: string;
};

const gold = "#d5c09a";
const muted = "#aaa59b";
const border = "#403a30";

const today = () => new Date().toLocaleDateString(
  "en-CA",
  {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }
);

function parseDate(value: string) {
  return new Date(value + "T12:00:00Z");
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function nightsBetween(start: string, end: string) {
  return Math.round(
    (parseDate(end).getTime() -
      parseDate(start).getTime()) / 86400000
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RentalCalendar({
  projectId,
}: Props) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(() => {
    const date = parseDate(today());
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    );
  });

  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [poolHeating, setPoolHeating] = useState(false);
  const [guests, setGuests] = useState(2);
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();

      const { data: result, error: fetchError } =
        await supabase.rpc("get_rental_calendar", {
          p_project_id: projectId,
        });

      if (!active) return;

      if (fetchError || !result) {
        setError("Availability is temporarily unavailable.");
      } else {
        setData(result as CalendarData);
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [projectId]);

  const settings = data?.settings;
  const unavailable = data?.unavailable ?? [];

  function isBlocked(day: string) {
    return unavailable.some(
      (period) =>
        day >= period.check_in && day < period.check_out
    );
  }

  function rangeAvailable(start: string, end: string) {
    return !unavailable.some(
      (period) =>
        start < period.check_out && end > period.check_in
    );
  }

  function selectDate(day: string) {
    setMessage("");
    setSubmitted(false);

    if (day < today()) return;

    if (!checkIn || checkOut || day <= checkIn) {
      if (isBlocked(day)) return;
      setCheckIn(day);
      setCheckOut(null);
      return;
    }

    const nights = nightsBetween(checkIn, day);

    if (nights < (settings?.minimum_nights ?? 7)) {
      setMessage("Minimum stay is 7 nights.");
      return;
    }

    if (!rangeAvailable(checkIn, day)) {
      setMessage("These dates are unavailable.");
      return;
    }

    setCheckOut(day);
  }

  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();

  const firstDay = new Date(
    Date.UTC(year, monthIndex, 1)
  );

  const offset = (firstDay.getUTCDay() + 6) % 7;

  const daysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();

  const cells = Array.from(
    { length: offset + daysInMonth },
    (_, index) => {
      const day = index - offset + 1;
      return day > 0
        ? formatDate(new Date(Date.UTC(year, monthIndex, day)))
        : null;
    }
  );

  const nights =
    checkIn && checkOut
      ? nightsBetween(checkIn, checkOut)
      : 0;

  const rentalTotal =
    nights * Number(settings?.nightly_rate_eur ?? 0);

  const heatingTotal =
    poolHeating && settings?.pool_heating_available
      ? nights * Number(settings.pool_heating_surcharge_eur ?? 0)
      : 0;

  const total = rentalTotal + heatingTotal;

  const buttonStyle: React.CSSProperties = {
    background: "transparent",
    border: `1px solid ${border}`,
    color: gold,
    padding: "12px 18px",
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "#0b0b0a",
    border: `1px solid ${border}`,
    color: "#eeeae2",
    padding: 14,
    fontSize: 15,
  };

  async function requestBooking() {
    if (!checkIn || !checkOut || !settings || submitting) return;

    if (
      nights < settings.minimum_nights ||
      !rangeAvailable(checkIn, checkOut) ||
      guests < 1 ||
      guests > settings.maximum_guests
    ) {
      setMessage("Please check your booking details.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { error: bookingError } = await supabase.rpc(
        "request_rental_booking",
        {
          p_project_id: projectId,
          p_check_in: checkIn,
          p_check_out: checkOut,
          p_guest_count: guests,
          p_preferred_check_in: arrivalTime || null,
          p_preferred_check_out: departureTime || null,
          p_pool_heating_requested: poolHeating,
          p_guest_notes: notes.trim() || null,
        }
      );

      if (bookingError) {
        setMessage(
          "Unable to submit your request. Please verify availability and try again."
        );
      } else {
        setSubmitted(true);
        setMessage(
          "Your test booking request has been submitted successfully."
        );
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p style={{ color: muted }}>Loading availability...</p>;
  }

  if (error || !settings) {
    return <p style={{ color: muted }}>{error || "Unavailable"}</p>;
  }

  return (
    <section
      style={{
        background: "#151411",
        padding: "clamp(24px,5vw,70px)",
        border: `1px solid ${border}`,
        color: "#eeeae2",
      }}
    >
      <p style={{ color: gold, letterSpacing: ".22em", fontSize: 12 }}>
        PRIVATE RENTAL · AVAILABILITY
      </p>

      <h2
        style={{
          fontFamily: "Georgia, serif",
          fontWeight: 400,
          fontSize: "clamp(36px,5vw,60px)",
        }}
      >
        Plan your stay.
      </h2>

      <p style={{ color: muted, lineHeight: 1.8 }}>
        Explore available dates and calculate your preferred stay.
        All reservations require approval by MZS Group.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(min(100%,330px),1fr))",
          gap: 45,
          marginTop: 40,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 25,
            }}
          >
            <button
              type="button"
              style={buttonStyle}
              disabled={
                formatDate(month).slice(0, 7) <= today().slice(0, 7)
              }
              onClick={() =>
                setMonth(
                  new Date(Date.UTC(year, monthIndex - 1, 1))
                )
              }
            >
              ←
            </button>

            <span style={{ fontFamily: "Georgia, serif", fontSize: 23 }}>
              {month.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>

            <button
              type="button"
              style={buttonStyle}
              onClick={() =>
                setMonth(
                  new Date(Date.UTC(year, monthIndex + 1, 1))
                )
              }
            >
              →
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
              gap: 5,
            }}
          >
            {["M", "T", "W", "T", "F", "S", "S"].map(
              (day, index) => (
                <div
                  key={index}
                  style={{
                    textAlign: "center",
                    color: gold,
                    padding: "10px 0",
                  }}
                >
                  {day}
                </div>
              )
            )}

            {cells.map((day, index) => {
              if (!day) return <div key={index} />;

              const blocked = isBlocked(day);
              const past = day < today();
              const selected = day === checkIn || day === checkOut;
              const inRange = Boolean(
                checkIn && checkOut &&
                day > checkIn && day < checkOut
              );

              return (
                <button
                  key={day}
                  type="button"
                  disabled={past || blocked}
                  onClick={() => selectDate(day)}
                  aria-label={`${day}${blocked ? ", unavailable" : ""}`}
                  aria-pressed={selected}
                  style={{
                    padding: "12px 3px",
                    minHeight: 45,
                    border: `1px solid ${border}`,
                    background: selected
                      ? gold
                      : blocked
                      ? "#28231f"
                      : inRange
                      ? "#54432a"
                      : "transparent",
                    color: selected
                      ? "#111"
                      : blocked || past
                      ? "#706a62"
                      : "#eeeae2",
                    cursor: past || blocked
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>

          <p style={{ color: muted, fontSize: 12, marginTop: 20 }}>
            □ Available &nbsp; ■ Selected &nbsp; ■ Unavailable
          </p>
        </div>

        <div>
          <p style={{ color: gold, letterSpacing: ".16em" }}>
            YOUR SELECTION
          </p>

          <div style={{ display: "flex", gap: 40, margin: "25px 0" }}>
            <div>
              <p style={{ color: muted }}>Check-in</p>
              <strong>{checkIn || "Select date"}</strong>
            </div>
            <div>
              <p style={{ color: muted }}>Check-out</p>
              <strong>{checkOut || "Select date"}</strong>
            </div>
          </div>

          <label style={{ color: muted }}>
            <input
              type="checkbox"
              checked={poolHeating}
              disabled={!settings.pool_heating_available}
              onChange={(event) =>
                setPoolHeating(event.target.checked)
              }
            />
            {" "}Pool heating (
            {money(Number(settings.pool_heating_surcharge_eur ?? 0))}
            /day)
          </label>

          <div
            style={{
              borderTop: `1px solid ${border}`,
              marginTop: 30,
              paddingTop: 25,
              lineHeight: 2,
            }}
          >
            <div>
              {nights} nights × {money(Number(settings.nightly_rate_eur))}
            </div>

            {poolHeating && (
              <div>Pool heating: {money(heatingTotal)}</div>
            )}

            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 42,
                marginTop: 15,
              }}
            >
              {money(total)}
            </div>

            <p style={{ color: muted, fontSize: 12 }}>
              Estimated total · Minimum {settings.minimum_nights} nights
            </p>
          </div>

          {checkIn && checkOut && !submitted && (
            <div
              style={{
                borderTop: `1px solid ${border}`,
                marginTop: 30,
                paddingTop: 25,
                display: "grid",
                gap: 18,
              }}
            >
              <p style={{ color: gold, letterSpacing: ".16em" }}>
                REQUEST YOUR STAY
              </p>

              <label>
                Number of guests
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={settings.maximum_guests}
                  value={guests}
                  onChange={(event) =>
                    setGuests(Number(event.target.value))
                  }
                />
              </label>

              <label>
                Preferred check-in time (optional)
                <input
                  style={inputStyle}
                  type="time"
                  value={arrivalTime}
                  onChange={(event) =>
                    setArrivalTime(event.target.value)
                  }
                />
              </label>

              <label>
                Preferred check-out time (optional)
                <input
                  style={inputStyle}
                  type="time"
                  value={departureTime}
                  onChange={(event) =>
                    setDepartureTime(event.target.value)
                  }
                />
              </label>

              <label>
                Special requests (optional)
                <textarea
                  style={inputStyle}
                  rows={4}
                  maxLength={2000}
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                />
              </label>

              <button
                type="button"
                disabled={submitting}
                onClick={requestBooking}
                style={{
                  background: gold,
                  border: "none",
                  padding: 18,
                  color: "#111",
                  cursor: submitting ? "wait" : "pointer",
                  letterSpacing: ".12em",
                }}
              >
                {submitting
                  ? "SUBMITTING..."
                  : "SUBMIT TEST BOOKING REQUEST →"}
              </button>

              <p style={{ color: muted, fontSize: 12 }}>
                Test mode only. This request does not reserve
                or block the selected dates.
              </p>
            </div>
          )}

          {message && (
            <p
              role="status"
              style={{
                marginTop: 25,
                color: submitted ? gold : "#d9a58f",
                lineHeight: 1.7,
              }}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
