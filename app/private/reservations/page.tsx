
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

type Booking = {
  id: string;
  project_id: string;
  rental_configuration_id: string | null;
  check_in: string;
  check_out: string;
  guest_count: number | null;
  status: string;
  is_test: boolean;
  quoted_total_eur: number | null;
  created_at: string;
};

type Project = {
  id: string;
  title: string;
  slug: string;
};

type Configuration = {
  id: string;
  title: string;
};

type Cancellation = {
  booking_id: string;
  status: string;
};

const gold = "#d5c09a";
const muted = "#aaa59b";
const border = "#403a30";

function formatDate(value: string) {
  return new Date(value + "T12:00:00Z").toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
  );
}

function formatMoney(value: number | null) {
  if (value === null) return "Price unavailable";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function MyReservationsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [configurations, setConfigurations] =
    useState<Configuration[]>([]);
  const [cancellations, setCancellations] =
    useState<Cancellation[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      window.location.assign("/login?role=client");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", auth.user.id)
      .single();

    if (
      !profile?.is_active ||
      !["client", "partner"].includes(profile.role)
    ) {
      setError("Your account is not authorized.");
      setLoading(false);
      return;
    }

    const { data, error: bookingError } = await supabase
      .from("rental_bookings")
      .select(
        "id,project_id,rental_configuration_id,check_in,check_out,guest_count,status,is_test,quoted_total_eur,created_at"
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (bookingError) {
      setError("Unable to load your reservations.");
      setLoading(false);
      return;
    }

    const ownBookings = (data ?? []) as Booking[];
    setBookings(ownBookings);

    const projectIds = [
      ...new Set(ownBookings.map((b) => b.project_id)),
    ];

    const configurationIds = [
      ...new Set(
        ownBookings
          .map((b) => b.rental_configuration_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    if (projectIds.length) {
      const { data: projectData } = await supabase
        .from("projects")
        .select("id,title,slug")
        .in("id", projectIds);

      setProjects((projectData ?? []) as Project[]);
    } else {
      setProjects([]);
    }

    if (configurationIds.length) {
      const { data: configurationData } = await supabase
        .from("rental_configurations")
        .select("id,title")
        .in("id", configurationIds);

      setConfigurations(
        (configurationData ?? []) as Configuration[]
      );
    } else {
      setConfigurations([]);
    }

    const { data: cancellationData } = await supabase
      .from("rental_cancellation_requests")
      .select("booking_id,status")
      .eq("user_id", auth.user.id);

    setCancellations(
      (cancellationData ?? []) as Cancellation[]
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function withdraw(id: string) {
    if (!window.confirm("Withdraw this booking request?")) return;

    setBusyId(id);
    setMessage("");
    setError("");

    const supabase = createClient();
    const { error: actionError } = await supabase.rpc(
      "withdraw_rental_request",
      { p_booking_id: id }
    );

    if (actionError) {
      setError("Unable to withdraw this request.");
    } else {
      setMessage("Your booking request has been withdrawn.");
      await load();
    }

    setBusyId(null);
  }

  async function requestCancellation(id: string) {
    if (reason.trim().length < 5) {
      setError("Please provide a reason of at least 5 characters.");
      return;
    }

    setBusyId(id);
    setError("");
    setMessage("");

    const supabase = createClient();
    const { error: actionError } = await supabase.rpc(
      "request_booking_cancellation",
      {
        p_booking_id: id,
        p_reason: reason.trim(),
      }
    );

    if (actionError) {
      setError("Unable to submit your cancellation request.");
    } else {
      setMessage(
        "Your cancellation request has been sent to MZS Group."
      );
      setReasonId(null);
      setReason("");
      await load();
    }

    setBusyId(null);
  }

  const buttonStyle: React.CSSProperties = {
    border: `1px solid ${gold}`,
    background: "transparent",
    color: gold,
    padding: "13px 19px",
    fontSize: 12,
    letterSpacing: ".1em",
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0a",
        color: "#eeeae2",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header
        style={{
          padding: "25px clamp(22px,5vw,80px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          borderBottom: `1px solid ${border}`,
        }}
      >
        <Link
          href="/"
          style={{
            color: gold,
            textDecoration: "none",
            fontFamily: "Georgia, serif",
            fontSize: 22,
            letterSpacing: ".13em",
          }}
        >
          MZS GROUP
        </Link>

        <Link
          href="/private"
          style={{
            color: gold,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          ← PRIVATE COLLECTION
        </Link>
      </header>

      <section
        style={{
          maxWidth: 1150,
          margin: "0 auto",
          padding: "65px 24px 110px",
        }}
      >
        <p
          style={{
            color: gold,
            letterSpacing: ".2em",
            fontSize: 12,
          }}
        >
          MZS PRIVATE COLLECTION
        </p>

        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(38px,5vw,64px)",
            fontWeight: 400,
            margin: "18px 0",
          }}
        >
          My Reservations.
        </h1>

        <p style={{ color: muted, lineHeight: 1.8 }}>
          View your private stays and manage booking requests.
          Confirmed reservations are managed personally by MZS Group.
        </p>

        {error && (
          <p role="alert" style={{ color: "#e4a999" }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: gold }}>
            {message}
          </p>
        )}

        {loading ? (
          <p style={{ color: muted, marginTop: 45 }}>
            Loading reservations...
          </p>
        ) : bookings.length === 0 ? (
          <article
            style={{
              marginTop: 45,
              padding: 35,
              border: `1px solid ${border}`,
            }}
          >
            <h2 style={{ fontFamily: "Georgia, serif" }}>
              No reservations yet.
            </h2>
            <p style={{ color: muted }}>
              Your future stays and booking requests will appear here.
            </p>
            <Link href="/private" style={{ color: gold }}>
              Explore Private Collection →
            </Link>
          </article>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 22,
              marginTop: 45,
            }}
          >
            {bookings.map((booking) => {
              const project = projects.find(
                (p) => p.id === booking.project_id
              );

              const configuration = configurations.find(
                (c) => c.id === booking.rental_configuration_id
              );

              const pendingCancellation = cancellations.some(
                (c) =>
                  c.booking_id === booking.id &&
                  c.status === "pending"
              );

              return (
                <article
                  key={booking.id}
                  style={{
                    padding: "clamp(22px,4vw,38px)",
                    background: "#171613",
                    border: `1px solid ${border}`,
                  }}
                >
                  <p
                    style={{
                      color: gold,
                      fontSize: 12,
                      letterSpacing: ".14em",
                    }}
                  >
                    {booking.is_test ? "TEST BOOKING" : "PRIVATE RENTAL"}
                    {" · "}
                    {booking.status.replace(/_/g, " ").toUpperCase()}
                  </p>

                  <h2
                    style={{
                      fontFamily: "Georgia, serif",
                      fontWeight: 400,
                      fontSize: 32,
                    }}
                  >
                    {project?.title ?? "Private Property"}
                  </h2>

                  {configuration && (
                    <p style={{ color: muted }}>
                      {configuration.title}
                    </p>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(140px,1fr))",
                      gap: 25,
                      margin: "30px 0",
                    }}
                  >
                    {[
                      ["Check-in", formatDate(booking.check_in)],
                      ["Check-out", formatDate(booking.check_out)],
                      ["Guests", booking.guest_count ?? "—"],
                      ["Quoted total", formatMoney(booking.quoted_total_eur)],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <p style={{ color: muted, fontSize: 12 }}>
                          {label}
                        </p>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {project && (
                      <Link
                        href={`/private/projects/${project.slug}`}
                        style={buttonStyle}
                      >
                        VIEW PROPERTY →
                      </Link>
                    )}

                    {booking.status === "requested" && (
                      <button
                        style={buttonStyle}
                        disabled={busyId === booking.id}
                        onClick={() => void withdraw(booking.id)}
                      >
                        WITHDRAW REQUEST
                      </button>
                    )}

                    {booking.status === "confirmed" &&
                      !pendingCancellation && (
                        <button
                          style={buttonStyle}
                          onClick={() => {
                            setReasonId(booking.id);
                            setReason("");
                          }}
                        >
                          REQUEST CANCELLATION
                        </button>
                      )}
                  </div>

                  {pendingCancellation && (
                    <p style={{ color: gold }}>
                      Cancellation request awaiting MZS review.
                    </p>
                  )}

                  {reasonId === booking.id && (
                    <div style={{ marginTop: 25 }}>
                      <label htmlFor={`reason-${booking.id}`}>
                        Reason for cancellation
                      </label>
                      <textarea
                        id={`reason-${booking.id}`}
                        value={reason}
                        maxLength={2000}
                        rows={4}
                        onChange={(event) =>
                          setReason(event.target.value)
                        }
                        style={{
                          display: "block",
                          boxSizing: "border-box",
                          width: "100%",
                          background: "#0b0b0a",
                          border: `1px solid ${border}`,
                          color: "#eeeae2",
                          padding: 15,
                          margin: "12px 0",
                        }}
                      />

                      <button
                        style={buttonStyle}
                        disabled={busyId === booking.id}
                        onClick={() =>
                          void requestCancellation(booking.id)
                        }
                      >
                        SEND CANCELLATION REQUEST
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
