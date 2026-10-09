"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, } from "react";
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
    quoted_total_eur: number | string | null;
    guest_notes: string | null;
    admin_notes: string | null;
    created_at: string;
};
type Person = {
    id: string;
    full_name: string | null;
    email: string;
};
type Property = {
    id: string;
    title: string;
};
type CancellationRequest = {
    id: string;
    booking_id: string;
    user_id: string;
    reason: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
};
type Snapshot = {
    bookings: Booking[];
    people: Person[];
    properties: Property[];
    cancellations: CancellationRequest[];
};
type Section = "bookings" | "cancellations";
type BookingFilter = "all" | "requested" | "reviewed";
type CancellationFilter = "pending" | "approved" | "declined" | "all";
type Decision = "approved" | "declined";
type Notice = {
    kind: "success" | "error";
    text: string;
};
type Mutation = {
    key: string;
    functionName: "review_rental_booking" | "delete_test_rental_booking" | "review_booking_cancellation";
    args: Record<string, string | null>;
    expected: string | boolean;
    success: string;
};
const gold = "#d5c09a";
const muted = "#aaa398";
const border = "#514839";
const warning = "#e3a995";
const rowStyle: CSSProperties = { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 };
const cardStyle: CSSProperties = { padding: "clamp(20px,3vw,34px)", border: `1px solid ${border}`, background: "#151411" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 20, marginTop: 26 };
const titleStyle: CSSProperties = { fontFamily: "Georgia, serif", fontSize: 29, fontWeight: 400, lineHeight: 1.2, margin: "0 0 10px" };
const badgeStyle: CSSProperties = { color: gold, border: `1px solid ${border}`, padding: "9px 12px", fontSize: 12, letterSpacing: ".08em", lineHeight: 1.5 };
// Same eligibility as My Reservations and the cancellation RPCs.
function isCancellationEligible(booking: Booking): boolean {
    return ((booking.is_test === true && booking.status === "test_approved") ||
        (booking.is_test === false && booking.status === "confirmed"));
}
function formatDate(value: string): string {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function formatTimestamp(value: string | null): string {
    if (!value)
        return "Not yet reviewed";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatTime(value: string | null): string { return value ? value.slice(0, 5) : "Not specified"; }
function formatMoney(value: number | string | null): string {
    if (value === null || !Number.isFinite(Number(value)))
        return "Price unavailable";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(Number(value));
}
function statusLabel(value: string): string { return value.replace(/_/g, " ").toUpperCase(); }
function actionErrorMessage(value: unknown): string {
    const message = typeof value === "object" && value !== null && "message" in value && typeof value.message === "string" ? value.message : "";
    const known: Record<string, string> = {
        "Administrator access required": "Active administrator access is required. Sign in again and refresh.",
        "Cancellation request already reviewed": "This cancellation request has already been reviewed. Check its current status.",
        "Booking is no longer eligible for cancellation review": "The booking is no longer eligible for this action. Check its current status.",
        "Cancellation requester does not match booking owner": "The cancellation requester does not match the booking owner. No action was completed.",
        "Cancellation request not found": "This cancellation request is no longer available.",
        "Booking not found": "This booking is no longer available.",
        "Booking already reviewed": "This booking has already been reviewed. Check its current status.",
        "Dates are no longer available": "These dates are no longer available. The booking was not confirmed.",
        "Booking starts in the past": "A booking starting in the past cannot be confirmed.",
        "Test booking not found or cannot be deleted": "This record cannot be deleted with the test-booking function.",
        "Invalid decision": "The decision was not accepted. Refresh before trying again.",
    };
    return known[message] ?? "The outcome could not be confirmed. Refresh and check the current status before trying again.";
}
function ActionButton({ children, onClick, disabled = false, primary = false, danger = false, selected }: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;
    danger?: boolean;
    selected?: boolean;
}) {
    return <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} style={{ padding: "13px 18px", fontSize: 12, lineHeight: 1.4, letterSpacing: ".07em", fontFamily: "inherit",
            border: `1px solid ${danger ? "#b78578" : gold}`, background: primary ? gold : "transparent",
            color: primary ? "#10100d" : danger ? warning : gold, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
    {children}
  </button>;
}
function Detail({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return <div><p style={{ color: muted, fontSize: 13, margin: "0 0 8px" }}>{label}</p>
    <p style={{ margin: 0, lineHeight: 1.6, overflowWrap: "anywhere" }}>{children}</p></div>;
}
export default function BookingManagement() {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState<Notice | null>(null);
    const [section, setSection] = useState<Section>("bookings");
    const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
    const [cancellationFilter, setCancellationFilter] = useState<CancellationFilter>("pending");
    const mounted = useRef(false);
    const loadVersion = useRef(0);
    const mutationInProgress = useRef(false);
    const reload = useCallback(async (): Promise<boolean> => {
        if (!mounted.current)
            return false;
        const version = ++loadVersion.current;
        const current = () => mounted.current && version === loadVersion.current;
        setLoading(true);
        setError("");
        try {
            const supabase = createClient();
            const { data: auth, error: authError } = await supabase.auth.getUser();
            if (!current())
                return false;
            if (authError || !auth.user)
                throw new Error("Please sign in again with your administrator account.");
            const { data: profile, error: profileError } = await supabase.from("profiles")
                .select("role,is_active").eq("id", auth.user.id).single();
            if (!current())
                return false;
            if (profileError || profile?.role !== "admin" || profile.is_active !== true) {
                throw new Error("Active administrator access is required.");
            }
            const [bookingsResult, peopleResult, propertiesResult, requestsResult] = await Promise.all([
                supabase.from("rental_bookings")
                    .select("id,project_id,user_id,check_in,check_out,guest_count,preferred_check_in,preferred_check_out,pool_heating_requested,status,is_test,quoted_total_eur,guest_notes,admin_notes,created_at", { count: "exact" })
                    .order("created_at", { ascending: false }),
                supabase.from("profiles").select("id,full_name,email", { count: "exact" }),
                supabase.from("projects").select("id,title", { count: "exact" }),
                supabase.from("rental_cancellation_requests")
                    .select("id,booking_id,user_id,reason,status,created_at,reviewed_at,reviewed_by", { count: "exact" })
                    .order("created_at", { ascending: false }),
            ]);
            if (!current())
                return false;
            const results = [bookingsResult, peopleResult, propertiesResult, requestsResult];
            if (results.some(result => result.error))
                throw new Error("Unable to load booking and cancellation records. Refresh before taking any action.");
            if (results.some(result => result.count !== null && result.count > (result.data?.length ?? 0))) {
                throw new Error("The overview exceeds the current loading limit. Pagination is required before these records can be managed here.");
            }
            setSnapshot({ bookings: (bookingsResult.data ?? []) as Booking[], people: (peopleResult.data ?? []) as Person[],
                properties: (propertiesResult.data ?? []) as Property[], cancellations: (requestsResult.data ?? []) as CancellationRequest[] });
            return true;
        }
        catch (cause) {
            if (current()) {
                setSnapshot(null);
                setError(cause instanceof Error ? cause.message : "Unable to load administration records. Please refresh.");
            }
            return false;
        }
        finally {
            if (current())
                setLoading(false);
        }
    }, []);
    useEffect(() => {
        mounted.current = true;
        void reload();
        return () => { mounted.current = false; loadVersion.current += 1; };
    }, [reload]);
    async function runMutation(options: Mutation) {
        if (mutationInProgress.current || loading || error || !snapshot)
            return;
        mutationInProgress.current = true;
        setBusy(options.key);
        setNotice(null);
        try {
            // All writes go through the existing permission-checked RPCs.
            const { data, error: rpcError } = await createClient().rpc(options.functionName, options.args);
            if (rpcError)
                throw rpcError;
            if (data !== options.expected)
                throw new Error("Unexpected result");
            const refreshed = await reload();
            if (mounted.current)
                setNotice({ kind: refreshed ? "success" : "error", text: refreshed ? options.success
                        : `${options.success} The overview could not be refreshed. Refresh before another action.` });
        }
        catch (cause) {
            const text = actionErrorMessage(cause);
            await reload(); // Never automatically retry a mutation with an uncertain outcome.
            if (mounted.current)
                setNotice({ kind: "error", text });
        }
        finally {
            mutationInProgress.current = false;
            if (mounted.current)
                setBusy(null);
        }
    }
    function reviewBooking(booking: Booking, decision: Decision) {
        if (mutationInProgress.current || booking.status !== "requested")
            return;
        const property = snapshot?.properties.find(item => item.id === booking.project_id);
        const person = snapshot?.people.find(item => item.id === booking.user_id);
        const effect = decision === "declined" ? "The booking request will be declined." : booking.is_test
            ? "This approves a TEST request. No dates will be reserved." : "This confirms a REAL booking and reserves the selected nights.";
        if (!window.confirm(`${decision === "approved" ? "Approve" : "Decline"} booking request?\n\nProperty: ${property?.title ?? "Property unavailable"}\nClient: ${person?.email ?? "Account unavailable"}\nStay: ${formatDate(booking.check_in)} – ${formatDate(booking.check_out)}\n\n${effect}`))
            return;
        const expected = decision === "declined" ? "declined" : booking.is_test ? "test_approved" : "confirmed";
        void runMutation({ key: `booking:${booking.id}`, functionName: "review_rental_booking",
            args: { p_booking_id: booking.id, p_decision: decision, p_admin_notes: booking.admin_notes }, expected,
            success: `Booking status updated: ${statusLabel(expected)}.` });
    }
    function removeTest(booking: Booking) {
        if (mutationInProgress.current || !booking.is_test || !["requested", "test_approved", "declined", "cancelled"].includes(booking.status))
            return;
        const property = snapshot?.properties.find(item => item.id === booking.project_id);
        if (!window.confirm(`Permanently DELETE this TEST booking?\n\nProperty: ${property?.title ?? "Property unavailable"}\nStay: ${formatDate(booking.check_in)} – ${formatDate(booking.check_out)}\nReference: ${booking.id}\n\nThis also removes its test cancellation history and cannot be undone. Real bookings and availability blocks are not part of this action.`))
            return;
        void runMutation({ key: `booking:${booking.id}`, functionName: "delete_test_rental_booking",
            args: { p_booking_id: booking.id }, expected: true, success: "Test booking and its linked test cancellation records permanently deleted." });
    }
    function reviewCancellation(request: CancellationRequest, decision: Decision) {
        const booking = snapshot?.bookings.find(item => item.id === request.booking_id);
        if (mutationInProgress.current || request.status !== "pending" || !booking ||
            !isCancellationEligible(booking) || booking.user_id !== request.user_id)
            return;
        const property = snapshot?.properties.find(item => item.id === booking.project_id);
        const person = snapshot?.people.find(item => item.id === request.user_id);
        const effect = booking.is_test
            ? decision === "approved"
                ? "Only this TEST booking will become cancelled. The record stays a test; no real availability or payment is changed."
                : "Only this TEST cancellation request will be declined. The test booking stays approved and real availability is unchanged."
            : decision === "approved"
                ? "The REAL reservation will be cancelled. Its dates will be released, subject to other blocks. Booking history is retained. No refund or email is triggered here."
                : "Only the cancellation request will be declined. The REAL reservation remains confirmed and its nights remain reserved.";
        if (!window.confirm(`${decision === "approved" ? "APPROVE" : "DECLINE"} ${booking.is_test ? "TEST " : ""}cancellation request?\n\nClient: ${person?.full_name || person?.email || "Account unavailable"}\nProperty: ${property?.title ?? "Property unavailable"}\nStay: ${formatDate(booking.check_in)} – ${formatDate(booking.check_out)}\n\n${effect}`))
            return;
        const success = booking.is_test
            ? decision === "approved" ? "Test cancellation approved. The test booking is cancelled. Real availability is unchanged."
                : "Test cancellation declined. The test booking remains approved. Real availability is unchanged."
            : decision === "approved" ? "Cancellation approved. The reservation is cancelled and its history is retained. No refund has been processed."
                : "Cancellation request declined. The reservation remains confirmed.";
        void runMutation({ key: `cancellation:${request.id}`, functionName: "review_booking_cancellation",
            args: { p_request_id: request.id, p_decision: decision }, expected: decision, success });
    }
    const bookings = snapshot?.bookings ?? [];
    const cancellations = snapshot?.cancellations ?? [];
    const people = new Map((snapshot?.people ?? []).map(person => [person.id, person]));
    const properties = new Map((snapshot?.properties ?? []).map(property => [property.id, property]));
    const bookingMap = new Map(bookings.map(booking => [booking.id, booking]));
    const pendingBookings = bookings.filter(booking => booking.status === "requested").length;
    const pendingCancellations = cancellations.filter(request => request.status === "pending").length;
    const visibleBookings = bookings.filter(booking => bookingFilter === "all" ||
        (bookingFilter === "requested" ? booking.status === "requested" : booking.status !== "requested"));
    const visibleCancellations = cancellations.filter(request => cancellationFilter === "all" || request.status === cancellationFilter);
    const locked = loading || busy !== null || Boolean(error);
    return (<div style={{ color: "#eeeae2" }}>
      <div style={{ ...rowStyle, justifyContent: "space-between", marginBottom: 24 }}>
        <p style={{ color: muted, margin: 0, lineHeight: 1.7 }}>{snapshot ? `${pendingBookings} pending bookings · ${pendingCancellations} pending cancellations` : "Booking administration"}</p>
        <ActionButton disabled={loading || busy !== null} onClick={() => void reload()}>Refresh overview</ActionButton>
      </div>
      <nav aria-label="Booking administration sections" style={{ ...rowStyle, paddingBottom: 24, borderBottom: `1px solid ${border}`, marginBottom: 28 }}>
        <ActionButton primary={section === "bookings"} selected={section === "bookings"} disabled={busy !== null} onClick={() => setSection("bookings")}>Bookings</ActionButton>
        <ActionButton primary={section === "cancellations"} selected={section === "cancellations"} disabled={busy !== null} onClick={() => setSection("cancellations")}>
          Cancellation Requests{snapshot ? ` (${pendingCancellations})` : ""}
        </ActionButton>
      </nav>
      {notice && <p role={notice.kind === "error" ? "alert" : "status"} style={{ color: notice.kind === "error" ? warning : gold, lineHeight: 1.8 }}>{notice.text}</p>}
      {loading && <p role="status" style={{ color: muted }}>Loading booking administration...</p>}
      {error && <p role="alert" style={{ color: warning, lineHeight: 1.8 }}>{error}</p>}

      {!loading && !error && snapshot && section === "bookings" && (<>
          <div style={{ ...rowStyle, marginBottom: 24 }}>
            {([["all", "All"], ["requested", "Pending"], ["reviewed", "Reviewed"]] as const).map(([key, label]) => (<ActionButton key={key} primary={bookingFilter === key} selected={bookingFilter === key} onClick={() => setBookingFilter(key)}>{label}</ActionButton>))}
          </div>
          <p style={{ color: muted, fontSize: 13 }}>{bookings.length} records, including availability blocks.</p>
          {visibleBookings.length === 0 && <p style={{ color: muted }}>No bookings in this category.</p>}
          <div style={{ display: "grid", gap: 20 }}>
            {visibleBookings.map(booking => {
                const person = booking.user_id ? people.get(booking.user_id) : undefined;
                const property = properties.get(booking.project_id);
                const isBlock = booking.status === "blocked";
                const processing = busy === `booking:${booking.id}`;
                const hasCancellation = cancellations.some(request => request.booking_id === booking.id && request.status === "pending");
                const canDelete = booking.is_test && ["requested", "test_approved", "declined", "cancelled"].includes(booking.status);
                return (<article key={booking.id} style={cardStyle}>
                  <div style={{ ...rowStyle, alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div><h3 style={titleStyle}>{property?.title ?? "Property unavailable"}</h3>
                      <p style={{ color: muted, margin: 0, lineHeight: 1.7 }}>{isBlock ? "Availability block · no client reservation" : `${person?.full_name || "Unnamed client"} · ${person?.email || "Account unavailable"}`}</p>
                    </div>
                    <span style={badgeStyle}>{booking.is_test ? "TEST · " : "LIVE · "}{statusLabel(booking.status)}</span>
                  </div>
                  <div style={gridStyle}>
                    <Detail label="Check-in">{formatDate(booking.check_in)}</Detail>
                    <Detail label="Check-out">{formatDate(booking.check_out)}</Detail>
                    <Detail label="Guests">{booking.guest_count ?? "—"}</Detail>
                    <Detail label="Quoted total">{formatMoney(booking.quoted_total_eur)}</Detail>
                    <Detail label="Preferred arrival">{formatTime(booking.preferred_check_in)}</Detail>
                    <Detail label="Preferred departure">{formatTime(booking.preferred_check_out)}</Detail>
                    <Detail label="Pool heating">{booking.pool_heating_requested ? "Requested" : "No"}</Detail>
                    <Detail label="Received">{formatTimestamp(booking.created_at)}</Detail>
                  </div>
                  {booking.guest_notes && <p style={{ color: muted, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Guest notes: {booking.guest_notes}</p>}
                  {booking.admin_notes && <p style={{ color: muted, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Admin notes: {booking.admin_notes}</p>}
                  {hasCancellation && <p style={{ color: gold, lineHeight: 1.8 }}>
                    {booking.is_test ? "Test cancellation requested. Real availability is unchanged." : "Cancellation requested. The request itself has not released any dates."} Review it under Cancellation Requests.
                  </p>}
                  <div style={{ ...rowStyle, marginTop: 24 }}>
                    {booking.status === "requested" && <>
                      <ActionButton primary disabled={locked} onClick={() => reviewBooking(booking, "approved")}>{processing ? "Processing..." : booking.is_test ? "Approve test" : "Confirm booking"}</ActionButton>
                      <ActionButton disabled={locked} onClick={() => reviewBooking(booking, "declined")}>Decline</ActionButton>
                    </>}
                    {canDelete && <ActionButton danger disabled={locked} onClick={() => removeTest(booking)}>Delete test booking</ActionButton>}
                  </div>
                </article>);
            })}
          </div>
          <p style={{ color: muted, fontSize: 13, marginTop: 26, lineHeight: 1.8 }}>Test approvals do not reserve dates. Live approvals confirm reservations. Only eligible test records can be permanently deleted here, along with their test cancellation history.</p>
        </>)}

      {!loading && !error && snapshot && section === "cancellations" && (<>
          <h3 style={titleStyle}>Cancellation requests.</h3>
          <p style={{ color: muted, lineHeight: 1.8, maxWidth: 850 }}>Review cancellation requests submitted by clients. A pending request does not cancel the booking. For live reservations, dates remain reserved until approval. Test cancellations never affect real availability. Refund arrangements are handled separately.</p>
          <div style={{ ...rowStyle, margin: "26px 0" }}>
            {([["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"], ["all", "All"]] as const).map(([key, label]) => (<ActionButton key={key} primary={cancellationFilter === key} selected={cancellationFilter === key} onClick={() => setCancellationFilter(key)}>{label}</ActionButton>))}
          </div>
          {visibleCancellations.length === 0 && <div style={cardStyle}><p style={{ color: muted, margin: 0, lineHeight: 1.8 }}>{cancellationFilter === "pending" ? "No pending cancellation requests." : "No cancellation requests in this category."}</p></div>}
          <div style={{ display: "grid", gap: 20 }}>
            {visibleCancellations.map(request => {
                const booking = bookingMap.get(request.booking_id);
                const person = people.get(request.user_id);
                const property = booking ? properties.get(booking.project_id) : undefined;
                const reviewer = request.reviewed_by ? people.get(request.reviewed_by) : undefined;
                const canReview = request.status === "pending" && booking !== undefined && isCancellationEligible(booking) && booking.user_id === request.user_id;
                const processing = busy === `cancellation:${request.id}`;
                const typeLabel = !booking ? "BOOKING UNAVAILABLE" : booking.is_test ? "TEST" : "LIVE";
                return (<article key={request.id} style={cardStyle}>
                  <div style={{ ...rowStyle, alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div><h3 style={titleStyle}>{property?.title ?? "Property unavailable"}</h3>
                      <p style={{ color: muted, margin: 0, lineHeight: 1.7 }}>{person?.full_name || "Unnamed client"} · {person?.email || "Account unavailable"}</p>
                    </div>
                    <span style={badgeStyle}>{typeLabel} · CANCELLATION · {statusLabel(request.status)}</span>
                  </div>
                  <div style={gridStyle}>
                    <Detail label="Check-in">{booking ? formatDate(booking.check_in) : "Unavailable"}</Detail>
                    <Detail label="Check-out">{booking ? formatDate(booking.check_out) : "Unavailable"}</Detail>
                    <Detail label="Quoted booking total">{booking ? formatMoney(booking.quoted_total_eur) : "Unavailable"}</Detail>
                    <Detail label="Current booking status">{booking ? statusLabel(booking.status) : "Unavailable"}</Detail>
                    <Detail label="Cancellation requested">{formatTimestamp(request.created_at)}</Detail>
                    <Detail label="Reviewed">{formatTimestamp(request.reviewed_at)}</Detail>
                  </div>
                  <div style={{ borderLeft: `2px solid ${gold}`, padding: "8px 0 8px 20px", margin: "30px 0" }}>
                    <p style={{ color: gold, fontSize: 13, margin: "0 0 10px" }}>Client&apos;s reason</p>
                    <p style={{ color: "#eeeae2", lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: 0 }}>{request.reason}</p>
                  </div>
                  {request.reviewed_by && <p style={{ color: muted, fontSize: 13 }}>Reviewed by: {reviewer?.full_name || reviewer?.email || "MZS administrator"}</p>}
                  {booking?.is_test && <p style={{ color: gold, lineHeight: 1.8 }}>TEST ONLY — approving or declining this request never changes the real availability calendar. The booking remains marked as a test.</p>}
                  {canReview && <>
                    <p style={{ color: muted, lineHeight: 1.8 }}>{booking?.is_test
                            ? "Approving cancels only the test booking. Declining leaves it test-approved. Both outcomes are retained in the cancellation history."
                            : "Approving cancels this reservation and releases its dates, subject to other blocks. Declining keeps the reservation confirmed. Neither action processes a refund or sends an email."}</p>
                    <div style={{ ...rowStyle, marginTop: 24 }}>
                      <ActionButton primary disabled={locked} onClick={() => reviewCancellation(request, "approved")}>{processing ? "Processing..." : booking?.is_test ? "Approve test cancellation" : "Approve cancellation"}</ActionButton>
                      <ActionButton disabled={locked} onClick={() => reviewCancellation(request, "declined")}>{booking?.is_test ? "Decline test cancellation" : "Decline cancellation"}</ActionButton>
                    </div>
                  </>}
                  {request.status === "pending" && !canReview && <p style={{ color: warning, lineHeight: 1.8 }}>This request cannot be reviewed in its current state. Refresh and check the linked booking. No action is enabled.</p>}
                  {request.status !== "pending" && <p style={{ color: muted, lineHeight: 1.8 }}>This cancellation request has been reviewed and is retained in the history. No further decision is available for this request.</p>}
                </article>);
            })}
          </div>
          <p style={{ color: muted, fontSize: 13, marginTop: 26, lineHeight: 1.8 }}>Eligible bookings: confirmed live reservations and approved test bookings. Pending requests, rejected bookings, cancelled bookings and availability blocks cannot enter this cancellation workflow.</p>
        </>)}
    </div>);
}
