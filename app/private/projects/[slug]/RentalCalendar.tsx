
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

type Settings = {
  nightly_rate_eur: number;
  minimum_nights: number;
  maximum_guests: number;
  flexible_arrival: boolean;
  pool_heating_available: boolean;
  pool_heating_surcharge_eur: number | null;
};

type BlockedPeriod = {
  check_in: string;
  check_out: string;
};

type CalendarData = {
  settings: Settings;
  unavailable: BlockedPeriod[];
};

type Props = {
  projectId: string;
};

const gold = "#d5c09a";
const muted = "#aaa59b";
const border = "#403a30";

function toDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function nightsBetween(start: string, end: string) {
  return Math.round(
    (toDate(end).getTime() - toDate(start).getTime()) /
      86400000
  );
}

function money(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RentalCalendar({
  projectId,
}: Props) {
  const [data, setData] = useState<CalendarData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), 1)
    );
  });

  const [checkIn, setCheckIn] = useState<string | null>(
    null
  );
  const [checkOut, setCheckOut] = useState<string | null>(
    null
  );
  const [poolHeating, setPoolHeating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      setLoading(true);
      setError("");

      const supabase = createClient();

      const { data: result, error: fetchError } =
        await supabase.rpc("get_rental_calendar", {
          p_project_id: projectId,
        });

      if (!active) return;

      if (fetchError || !result) {
        setError(
          "Availability is temporarily unavailable."
        );
      } else {
        setData(result as CalendarData);
      }

      setLoading(false);
    }

    void loadCalendar();

    return () => {
      active = false;
    };
  }, [projectId]);

  const settings = data?.settings;
  const blocked = data?.unavailable ?? [];

  const today = dateKey(new Date());

  function isBlocked(day: string) {
    return blocked.some(
      (period) =>
        day >= period.check_in &&
        day < period.check_out
    );
  }

  function rangeIsAvailable(
    start: string,
    end: string
  ) {
    return !blocked.some(
      (period) =>
        start < period.check_out &&
        end > period.check_in
    );
  }

  function selectDay(day: string) {
    setMessage("");

    if (day < today) return;

    if (!checkIn || checkOut || day <= checkIn) {
      if (isBlocked(day)) {
        setMessage("This date is unavailable.");
        return;
      }

      setCheckIn(day);
      setCheckOut(null);
      return;
    }

    const minimum = settings?.minimum_nights ?? 7;
    const nights = nightsBetween(checkIn, day);

    if (nights < minimum) {
      setMessage(
        `A minimum stay of ${minimum} nights is required.`
      );
      return;
    }

    if (!rangeIsAvailable(checkIn, day)) {
      setMessage(
        "Your selected dates overlap with an unavailable period."
      );
      return;
    }

    setCheckOut(day);
  }

  function changeMonth(offset: number) {
    setMonth(
      (current) =>
        new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + offset,
            1
          )
        )
    );
  }

  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();

  const firstWeekday =
    (month.getUTCDay() + 6) % 7;

  const daysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0)
  ).getUTCDate();

  const monthLabel = month.toLocaleDateString(
    "en-GB",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  );

  const cells = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) => {
      const day = index - firstWeekday + 1;

      if (day < 1) return null;

      return dateKey(
        new Date(Date.UTC(year, monthIndex, day))
      );
    }
  );

  const nights =
    checkIn && checkOut
      ? nightsBetween(checkIn, checkOut)
      : 0;

  const rentalTotal =
    nights * (settings?.nightly_rate_eur ?? 0);

  const heatingTotal =
    poolHeating && settings?.pool_heating_available
      ? nights *
        (settings.pool_heating_surcharge_eur ?? 0)
      : 0;

  const total = rentalTotal + heatingTotal;

  const dateStyle: React.CSSProperties = {
    padding: "12px 4px",
    border: `1px solid ${border}`,
    background: "transparent",
    color: "#eeeae2",
    cursor: "pointer",
    fontSize: 13,
    minHeight: 46,
  };

  const navigationStyle: React.CSSProperties = {
    border: `1px solid ${border}`,
    background: "transparent",
    color: gold,
    padding: "10px 16px",
    cursor: "pointer",
  };

  if (loading) {
    return (
      <section style={{ padding: 30, color: muted }}>
        Loading availability...
      </section>
    );
  }

  if (error || !settings) {
    return (
      <section style={{ padding: 30, color: muted }}>
        {error || "Rental settings unavailable."}
      </section>
    );
  }

  return (
    <section
      style={{
        background: "#151411",
        padding: "clamp(25px,5vw,70px)",
        border: `1px solid ${border}`,
        color: "#eeeae2",
      }}
    >
      <p
        style={{
          color: gold,
          fontSize: 12,
          letterSpacing: ".22em",
        }}
      >
        PRIVATE RENTAL · AVAILABILITY
      </p>

      <h2
        style={{
          fontFamily: "Georgia, serif",
          fontWeight: 400,
          fontSize: "clamp(34px,5vw,58px)",
          margin: "15px 0 20px",
        }}
      >
        Plan your stay.
      </h2>

      <p
        style={{
          color: muted,
          lineHeight: 1.8,
          maxWidth: 650,
        }}
      >
        Explore available dates and calculate
        your preferred stay. All reservations
        require personal approval by MZS Group.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(min(100%,320px),1fr))",
          gap: 45,
          marginTop: 45,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 25,
              gap: 12,
            }}
          >
            <button
              type="button"
              style={navigationStyle}
              onClick={() => changeMonth(-1)}
              disabled={
                year < new Date().getFullYear() ||
                (year === new Date().getFullYear() &&
                  monthIndex <= new Date().getMonth())
              }
            >
              ←
            </button>

            <span
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 23,
              }}
            >
              {monthLabel}
            </span>

            <button
              type="button"
              style={navigationStyle}
              onClick={() => changeMonth(1)}
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
                    fontSize: 12,
                    padding: "10px 0",
                  }}
                >
                  {day}
                </div>
              )
            )}

            {cells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} />;
              }

              const unavailable = isBlocked(day);
              const past = day < today;
              const selected =
                day === checkIn || day === checkOut;

              const inRange =
                checkIn &&
                checkOut &&
                day > checkIn &&
                day < checkOut;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  disabled={
                    past ||
                    (unavailable &&
                      !(checkIn && !checkOut &&
                        day > checkIn))
                  }
                  aria-label={`${day}${
                    unavailable ? ", unavailable" : ""
                  }`}
                  aria-pressed={Boolean(selected)}
                  style={{
                    ...dateStyle,
                    background: selected
                      ? gold
                      : unavailable
                      ? "#28231f"
                      : inRange
                      ? "#373026"
                      : "transparent",
                    color: selected
                      ? "#111"
                      : unavailable || past
                      ? "#706a62"
                      : "#eeeae2",
                    cursor:
                      unavailable || past
                        ? "not-allowed"
                        : "pointer",
                    opacity: past ? 0.45 : 1,
                  }}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              marginTop: 20,
              color: muted,
              fontSize: 12,
            }}
          >
            <span>□ Available</span>
            <span style={{ color: gold }}>
              ■ Selected
            </span>
            <span>■ Unavailable</span>
          </div>

          {message && (
            <p
              role="status"
              style={{
                color: "#d9a58f",
                marginTop: 20,
                lineHeight: 1.6,
              }}
            >
              {message}
            </p>
          )}
        </div>

        <div
          style={{
            borderTop: `1px solid ${border}`,
            paddingTop: 25,
          }}
        >
          <p
            style={{
              color: gold,
              fontSize: 12,
              letterSpacing: ".16em",
            }}
          >
            YOUR SELECTION
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              margin: "25px 0",
            }}
          >
            <div>
              <p style={{ color: muted, fontSize: 12 }}>
                Check-in
              </p>
              <strong>{checkIn || "Select date"}</strong>
            </div>

            <div>
              <p style={{ color: muted, fontSize: 12 }}>
                Check-out
              </p>
              <strong>{checkOut || "Select date"}</strong>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              color: muted,
              margin: "25px 0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={poolHeating}
              onChange={(event) =>
                setPoolHeating(event.target.checked)
              }
              disabled={!settings.pool_heating_available}
            />

            Pool heating (
            {money(
              settings.pool_heating_surcharge_eur ?? 0
            )}
            /day)
          </label>

          <div
            style={{
              borderTop: `1px solid ${border}`,
              paddingTop: 25,
              lineHeight: 2,
            }}
          >
            <div>
              {nights} nights ×{" "}
              {money(settings.nightly_rate_eur)}
            </div>

            {poolHeating && (
              <div>
                Pool heating: {money(heatingTotal)}
              </div>
            )}

            <div
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 38,
                marginTop: 20,
              }}
            >
              {money(total)}
            </div>

            <p style={{ color: muted, fontSize: 12 }}>
              Estimated total · Minimum{" "}
              {settings.minimum_nights} nights
            </p>
          </div>

          <div
            style={{
              border: `1px solid ${border}`,
              padding: 18,
              marginTop: 30,
              color: muted,
              lineHeight: 1.7,
              fontSize: 13,
            }}
          >
            Booking requests will become available
            after the calendar testing phase.
            Selecting dates does not create a reservation.
          </div>
        </div>
      </div>
    </section>
  );
}
