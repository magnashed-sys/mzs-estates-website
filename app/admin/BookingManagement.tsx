"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, } from "react";
import RentalSchedule from "./RentalSchedule";
import RentalNotificationStatus from "./RentalNotificationStatus";
import { liveArrivals, matchesSearch, todayInMadrid } from "./admin-model";
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
    status: string;
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
    rentalPropertyIds: string[];
};
type Section = "bookings" | "cancellations" | "calendar";
type BookingFilter = "all" | "requested" | "confirmed" | "cancelled" | "declined" | "blocked" | "test_approved";
type CancellationFilter = "pending" | "approved" | "declined" | "all";
type Decision = "approved" | "declined";
type Notice = {
    kind: "success" | "error";
    text: string;
};
type Mutation = {
    key: string;
    functionName: "review_rental_booking" | "delete_test_rental_booking" | "review_booking_cancellation" | "admin_modify_live_rental_booking" | "admin_cancel_live_rental_booking";
    args: Record<string, string | number | null>;
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
const bookingInputStyle: CSSProperties = { width:"100%",maxWidth:"100%",minWidth:0,minHeight:46,boxSizing:"border-box",background:"#171612",color:"#eeeae2",border:"1px solid #665a45",padding:12,fontSize:15 };
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
        "Booking changed since last refresh": "Booking details have changed. Refresh before trying again.",
        "Only live pending or confirmed client bookings can be modified": "Only live client requests or confirmed bookings can be edited.",
        "Only confirmed live client bookings can be cancelled": "Only confirmed live reservations can be cancelled.",
        "Review pending cancellation request before editing": "Review the pending cancellation request before editing.",
        "Past reservation cannot be cancelled": "Past reservations cannot be cancelled.",
        "Minimum stay requirement not met": "Selected dates do not meet the minimum stay.",
        "Invalid guest count": "The number of guests is invalid.",
        "Invalid stay dates": "Please choose valid future stay dates.",
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
export default function BookingManagement({ mode = "full", initialSection = "bookings", onNavigate, onBusyChange }: {
    mode?: "full" | "summary";
    initialSection?: "bookings" | "cancellations";
    onNavigate?: (section: "bookings" | "cancellations") => void;
    onBusyChange?: (busy: boolean) => void;
} = {}) {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState<Notice | null>(null);
    const [section, setSection] = useState<Section>(initialSection);
    const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
    const [cancellationFilter, setCancellationFilter] = useState<CancellationFilter>("pending");
    const [search, setSearch] = useState("");
    const [propertyFilter, setPropertyFilter] = useState("all");
    const [scope, setScope] = useState<"live" | "test" | "all">("live");
    const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState({check_in:"", check_out:"", guest_count:"2", admin_notes:""});
    const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
    const [cancellationReason, setCancellationReason] = useState("");
    const [visibleLimit, setVisibleLimit] = useState(12);
    const [updated, setUpdated] = useState("");
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
            const [bookingsResult, peopleResult, propertiesResult, requestsResult, rentalsResult] = await Promise.all([
                supabase.rpc("admin_list_rental_bookings", {}, { count: "exact" })
                    .order("created_at", { ascending: false }),
                supabase.from("profiles").select("id,full_name,email", { count: "exact" }),
                supabase.from("projects").select("id,title,status", { count: "exact" }),
                supabase.from("rental_cancellation_requests")
                    .select("id,booking_id,user_id,reason,status,created_at,reviewed_at,reviewed_by", { count: "exact" })
                    .order("created_at", { ascending: false }),
                supabase.from("offerings").select("project_id", { count: "exact" }).eq("offering_type", "rental").eq("status", "active"),
            ]);
            if (!current())
                return false;
            const results = [bookingsResult, peopleResult, propertiesResult, requestsResult, rentalsResult];
            if (results.some(result => result.error))
                throw new Error("Unable to load booking and cancellation records. Refresh before taking any action.");
            if (results.some(result => result.count !== null && result.count > (result.data?.length ?? 0))) {
                throw new Error("The overview exceeds the current loading limit. Pagination is required before these records can be managed here.");
            }
            setSnapshot({ bookings: (bookingsResult.data ?? []) as Booking[], people: (peopleResult.data ?? []) as Person[],
                properties: (propertiesResult.data ?? []) as Property[], cancellations: (requestsResult.data ?? []) as CancellationRequest[],
                rentalPropertyIds: [...new Set((rentalsResult.data ?? []).map(row => row.project_id as string))] });
            setUpdated(new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }));
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
    useEffect(() => {
        if (!busy) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [busy]);
    async function runMutation(options: Mutation) {
        if (mutationInProgress.current || loading || error || !snapshot)
            return;
        mutationInProgress.current = true;
        onBusyChange?.(true);
        setBusy(options.key);
        setNotice(null);
        try {
            // All writes go through the existing permission-checked RPCs.
            const isAdminChange = ["admin_modify_live_rental_booking", "admin_cancel_live_rental_booking", "review_booking_cancellation"].includes(options.functionName);
            let data: unknown;
            let mailWarning = "";
            if (isAdminChange) {
                const result = await fetch("/api/rental/admin-booking", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ functionName: options.functionName, args: options.args }),
                });
                const body = await result.json();
                if (!result.ok) throw new Error(body.error || "Unexpected result");
                data = body.result;
                if (body.delivery === "captured") mailWarning = " Staging email captured; no email sent.";
                else if (body.delivery === "accepted") mailWarning = " Client email accepted by the mail server.";
                else if (body.delivery !== "none") mailWarning = " Check client notification status below; the booking change is saved.";
            } else {
                const result = await createClient().rpc(options.functionName, options.args);
                if (result.error) throw result.error;
                data = result.data;
            }
            if (data !== options.expected)
                throw new Error("Unexpected result");
            // Only a successful approval of a real booking triggers the guest email.
            // An email failure never undoes the confirmed reservation or retries approval.
            if (options.functionName === "review_rental_booking" && options.expected === "confirmed") {
                try {
                    const bookingId = options.args.p_booking_id;
                    const mailResponse = await fetch("/api/rental/booking-confirmation", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ bookingId }),
                    });
                    if (!mailResponse.ok) mailWarning = " Confirmation email could not be verified; review mail logs.";
                } catch {
                    mailWarning = " Confirmation email could not be verified; review mail logs.";
                }
            }
            const refreshed = await reload();
            if (options.functionName === "admin_modify_live_rental_booking") setEditingBookingId(null);
            if (options.functionName === "admin_cancel_live_rental_booking") setCancellingBookingId(null);
            if (mounted.current)
                setNotice({ kind: refreshed ? "success" : "error", text: refreshed ? options.success + mailWarning
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
            onBusyChange?.(false);
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
    function startEditingBooking(booking: Booking) {
        setNotice(null); setCancellingBookingId(null); setEditingBookingId(booking.id);
        setEditDraft({check_in:booking.check_in,check_out:booking.check_out,
          guest_count:String(booking.guest_count??1),admin_notes:booking.admin_notes??""});
    }
    function saveBooking(booking: Booking) {
        const guests=Number(editDraft.guest_count);
        if (mutationInProgress.current || !editDraft.check_in || !editDraft.check_out ||
            !Number.isInteger(guests) || guests<1 || editDraft.admin_notes.length>2000) {
            setNotice({kind:"error",text:"Review dates, guest count and admin notes."});return;
        }
        const property=snapshot?.properties.find(p=>p.id===booking.project_id);
        if (!window.confirm("Save changes to this LIVE booking?\\n\\nProperty: "+
             (property?.title??"Property")+"\\nOriginal: "+formatDate(booking.check_in)+" – "+
             formatDate(booking.check_out)+"\\nNew: "+formatDate(editDraft.check_in)+" – "+
             formatDate(editDraft.check_out)+"\\nGuests: "+guests+
             "\\n\\nThe original per-night rate is retained. Relevant changes to confirmed reservations queue a client email. Internal notes remain private. No refund is processed."))return;
        void runMutation({key:"booking:"+booking.id,functionName:"admin_modify_live_rental_booking",
          args:{p_booking_id:booking.id,p_check_in:editDraft.check_in,p_check_out:editDraft.check_out,
            p_guest_count:guests,p_expected_check_in:booking.check_in,
            p_expected_check_out:booking.check_out,p_expected_guest_count:booking.guest_count,
            p_admin_notes:editDraft.admin_notes},expected:"updated",
          success:"Booking updated."});
    }
    function cancelLiveBooking(booking: Booking) {
        const reason=cancellationReason.trim();
        if (mutationInProgress.current || reason.length<3) {
            setNotice({kind:"error",text:"A cancellation reason of at least 3 characters is required."});return;
        }
        const property=snapshot?.properties.find(p=>p.id===booking.project_id);
        if (!window.confirm("CANCEL this confirmed LIVE booking?\\n\\nProperty: "+
          (property?.title??"Property")+"\\nStay: "+formatDate(booking.check_in)+" – "+
          formatDate(booking.check_out)+"\\nReason: "+reason+
          "\\n\\nThe dates are released; a cancellation email is queued. No refund is processed."))return;
        void runMutation({key:"booking:"+booking.id,functionName:"admin_cancel_live_rental_booking",
          args:{p_booking_id:booking.id,p_reason:reason},expected:"cancelled",
          success:"Reservation cancelled and dates released. A client notification is queued; handle refunds separately."});
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
    function matchesBooking(booking: Booking) {
        const person = booking.user_id ? people.get(booking.user_id) : undefined;
        return (scope === "all" || booking.is_test === (scope === "test"))
            && (propertyFilter === "all" || booking.project_id === propertyFilter)
            && matchesSearch(search, person?.full_name, person?.email, properties.get(booking.project_id)?.title, booking.id);
    }
    const visibleBookings = bookings.filter(booking => matchesBooking(booking) && (bookingFilter === "all" || booking.status === bookingFilter));
    const visibleCancellations = cancellations.filter(request => {
        const booking = bookingMap.get(request.booking_id);
        const person = people.get(request.user_id);
        const matches = booking ? matchesBooking(booking) : scope === "all" && propertyFilter === "all" && matchesSearch(search, person?.full_name, person?.email, request.booking_id);
        return matches && (cancellationFilter === "all" || request.status === cancellationFilter);
    });
    const locked = loading || busy !== null || Boolean(error);
    const arrivals = liveArrivals(bookings, todayInMadrid());
    if (mode === "summary") return <section className="admin-rental-summary">
      <div className="admin-section-heading"><div><p className="eyebrow">Private rental</p><h2>Reservations at a glance.</h2></div><ActionButton disabled={locked} onClick={() => void reload()}>Refresh reservations</ActionButton></div>
      {loading && <p role="status" className="admin-help">Loading reservations…</p>}
      {error && <div className="admin-notice" role="alert">{error} <ActionButton onClick={() => void reload()} disabled={loading}>Try again</ActionButton></div>}
      {!loading && !error && snapshot && <>
        <div className="admin-metrics">
          <button onClick={() => onNavigate?.("bookings")}><span>Live booking requests</span><strong>{bookings.filter(b => !b.is_test && b.status === "requested").length}</strong><small>Review reservations →</small></button>
          <button onClick={() => onNavigate?.("cancellations")}><span>Live cancellations</span><strong>{cancellations.filter(r => r.status === "pending" && bookingMap.get(r.booking_id)?.is_test === false).length}</strong><small>Review requests →</small></button>
          <div><span>Upcoming arrivals</span><strong>{arrivals.length}</strong><small>Next 3 months, including today</small></div>
          <div><span>Current stays</span><strong>{bookings.filter(b => !b.is_test && b.status === "confirmed" && b.check_in <= todayInMadrid() && todayInMadrid() < b.check_out).length}</strong><small>Confirmed live reservations</small></div>
        </div>
        <p className="admin-help">Updated {updated} · Madrid time. Test bookings are excluded. {bookings.filter(b => b.is_test).length} test records are available under Bookings → Test.</p>
        <div className="admin-panel"><h3 className="admin-subtitle">Next arrivals.</h3>
          {!arrivals.length && <p className="admin-help">No confirmed arrivals in the next 3 months.</p>}
          {arrivals.map(booking => <button key={booking.id} className="admin-action-row" onClick={() => onNavigate?.("bookings")}><span><strong>{properties.get(booking.project_id)?.title ?? "Property unavailable"}</strong><small>{booking.user_id ? people.get(booking.user_id)?.full_name || people.get(booking.user_id)?.email || "Guest" : "Guest"}</small></span><span>{formatDate(booking.check_in)} →</span></button>)}
        </div>
      </>}
    </section>;
    return (<div className="admin-bookings" style={{ color: "#eeeae2" }}>
      <div style={{ ...rowStyle, justifyContent: "space-between", marginBottom: 24 }}>
        <p style={{ color: muted, margin: 0, lineHeight: 1.7 }}>{snapshot ? `${pendingBookings} pending bookings · ${pendingCancellations} pending cancellations · all live and test records` : "Booking administration"}</p>
        <ActionButton disabled={loading || busy !== null} onClick={() => void reload()}>Refresh overview</ActionButton>
      </div>
      <nav aria-label="Booking administration sections" style={{ ...rowStyle, paddingBottom: 24, borderBottom: `1px solid ${border}`, marginBottom: 28 }}>
        <ActionButton primary={section === "bookings"} selected={section === "bookings"} disabled={busy !== null} onClick={() => setSection("bookings")}>Bookings</ActionButton>
        <ActionButton primary={section === "cancellations"} selected={section === "cancellations"} disabled={busy !== null} onClick={() => setSection("cancellations")}>
          Cancellation Requests{snapshot ? ` (${pendingCancellations})` : ""}
        </ActionButton>
        <ActionButton primary={section === "calendar"} selected={section === "calendar"} disabled={busy !== null} onClick={() => setSection("calendar")}>Calendar</ActionButton>
      </nav>
      {section !== "calendar" && <div className="admin-toolbar">
        <label className="admin-field">Search<input type="search" disabled={locked} value={search} placeholder="Guest, property or reference" onChange={e => { setSearch(e.target.value); setVisibleLimit(12); }} /></label>
        <label className="admin-field">Property<select disabled={locked} value={propertyFilter} onChange={e => { setPropertyFilter(e.target.value); setVisibleLimit(12); }}><option value="all">All properties</option>{[...properties.values()].map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label className="admin-field">Records<select disabled={locked} value={scope} onChange={e => { setScope(e.target.value as "live" | "test" | "all"); setVisibleLimit(12); }}><option value="live">Live</option><option value="test">Test</option><option value="all">Live & test</option></select></label>
      </div>}
      {!loading && !error && snapshot && section === "calendar" && <RentalSchedule bookings={bookings} properties={snapshot.properties.filter(p => p.status === "active" && snapshot.rentalPropertyIds.includes(p.id))} />}

      {notice && <p role={notice.kind === "error" ? "alert" : "status"} style={{ color: notice.kind === "error" ? warning : gold, lineHeight: 1.8 }}>{notice.text}</p>}
      {loading && <p role="status" style={{ color: muted }}>Loading booking administration...</p>}
      {error && <p role="alert" style={{ color: warning, lineHeight: 1.8 }}>{error}</p>}

      {!loading && !error && snapshot && section === "bookings" && (<>
          <div style={{ ...rowStyle, marginBottom: 24 }}>
            {([["all", "All"], ["requested", "Pending"], ["confirmed", "Confirmed"], ["cancelled", "Cancelled"], ["declined", "Declined"], ["blocked", "Blocks"], ["test_approved", "Test approved"]] as const).map(([key, label]) => (<ActionButton key={key} primary={bookingFilter === key} selected={bookingFilter === key} onClick={() => { setBookingFilter(key); setVisibleLimit(12); }}>{label}</ActionButton>))}
          </div>
          <p style={{ color: muted, fontSize: 13 }}>{visibleBookings.length} matching records · {scope === "live" ? "Live only" : scope === "test" ? "Test only" : "Live and test"} · Updated {updated} Madrid time.</p>
          {visibleBookings.length === 0 && <p style={{ color: muted }}>No bookings in this category.</p>}
          <div style={{ display: "grid", gap: 20 }}>
            {visibleBookings.slice(0, visibleLimit).map(booking => {
                const person = booking.user_id ? people.get(booking.user_id) : undefined;
                const property = properties.get(booking.project_id);
                const isBlock = booking.status === "blocked";
                const processing = busy === `booking:${booking.id}`;
                const hasCancellation = cancellations.some(request => request.booking_id === booking.id && request.status === "pending");
                const canDelete = booking.is_test && ["requested", "test_approved", "declined", "cancelled"].includes(booking.status);
                const canEditLive = !booking.is_test && ["requested","confirmed"].includes(booking.status) && booking.user_id !== null && booking.check_in >= todayInMadrid();
                const canCancelLive = !booking.is_test && booking.status === "confirmed" && booking.user_id !== null && booking.check_out > todayInMadrid();
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
                    {canEditLive && <ActionButton disabled={locked} onClick={() => startEditingBooking(booking)}>Edit booking</ActionButton>}
                    {canCancelLive && <ActionButton danger disabled={locked} onClick={() => {setEditingBookingId(null);setCancellingBookingId(booking.id);setCancellationReason("");setNotice(null);}}>Cancel reservation</ActionButton>}
                    {canDelete && <ActionButton danger disabled={locked} onClick={() => removeTest(booking)}>Delete test booking</ActionButton>}
                  </div>
                  {editingBookingId === booking.id && <form onSubmit={e=>{e.preventDefault();saveBooking(booking);}}
                    style={{display:"grid",gap:14,marginTop:20,padding:18,border:"1px solid "+border}}>
                    <h4 style={{margin:0,color:gold}}>Edit live booking</h4>
                    <p style={{color:muted,margin:0}}>Update dates, guest count or notes. The original nightly price is retained.</p>
                    <label style={{display:"grid",gap:6}}>Check-in
                      <input style={bookingInputStyle} type="date" required min={todayInMadrid()} value={editDraft.check_in} onChange={e=>setEditDraft(d=>({...d,check_in:e.target.value}))}/>
                    </label>
                    <label style={{display:"grid",gap:6}}>Check-out
                      <input style={bookingInputStyle} type="date" required min={editDraft.check_in||todayInMadrid()} value={editDraft.check_out} onChange={e=>setEditDraft(d=>({...d,check_out:e.target.value}))}/>
                    </label>
                    <label style={{display:"grid",gap:6}}>Guests
                      <input style={bookingInputStyle} type="number" min={1} required value={editDraft.guest_count} onChange={e=>setEditDraft(d=>({...d,guest_count:e.target.value}))}/>
                    </label>
                    <label style={{display:"grid",gap:6}}>Internal admin notes
                      <textarea style={bookingInputStyle} rows={3} maxLength={2000} value={editDraft.admin_notes} onChange={e=>setEditDraft(d=>({...d,admin_notes:e.target.value}))}/>
                    </label>
                    <div style={rowStyle}>
                      <button className="admin-button admin-button-primary" type="submit" disabled={locked}>Save changes</button>
                      <button className="admin-button" type="button" disabled={locked} onClick={()=>setEditingBookingId(null)}>Close</button>
                    </div>
                    <p style={{color:muted,margin:0}}>Relevant changes to confirmed reservations queue a client email. Internal notes stay private. No refund is processed.</p>
                  </form>}
                  {cancellingBookingId === booking.id && <div style={{display:"grid",gap:14,marginTop:20,padding:18,border:"1px solid "+border}}>
                    <h4 style={{margin:0,color:warning}}>Cancel confirmed reservation</h4>
                    <label style={{display:"grid",gap:6}}>Cancellation reason
                      <textarea style={bookingInputStyle} rows={3} minLength={3} maxLength={1000} required value={cancellationReason} onChange={e=>setCancellationReason(e.target.value)}/>
                    </label>
                    <div style={rowStyle}>
                      <button className="admin-button" type="button" disabled={locked || cancellationReason.trim().length<3} onClick={()=>cancelLiveBooking(booking)}>Confirm cancellation</button>
                      <button className="admin-button" type="button" disabled={locked} onClick={()=>setCancellingBookingId(null)}>Keep reservation</button>
                    </div>
                    <p style={{color:muted,margin:0}}>This releases reserved dates and queues a cancellation email. The reason stays internal. Refunds are handled separately.</p>
                  </div>}
                </article>);
            })}
          </div>
          {visibleBookings.length > visibleLimit && <ActionButton disabled={locked} onClick={() => setVisibleLimit(v => v + 12)}>Show more bookings</ActionButton>}
          <p style={{ color: muted, fontSize: 13, marginTop: 26, lineHeight: 1.8 }}>Test approvals do not reserve dates. Live approvals confirm reservations. Administrators may amend or cancel live reservations, with the audit history retained. Relevant changes and cancellations queue client notifications. No automatic refund is processed. Only eligible test records can be permanently deleted.</p>
        </>)}

      {!loading && !error && snapshot && section === "cancellations" && (<>
          <h3 style={titleStyle}>Cancellation requests.</h3>
          <p style={{ color: muted, lineHeight: 1.8, maxWidth: 850 }}>Review cancellation requests submitted by clients. A pending request does not cancel the booking. For live reservations, dates remain reserved until approval. Test cancellations never affect real availability. Refund arrangements are handled separately.</p>
          <div style={{ ...rowStyle, margin: "26px 0" }}>
            {([["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"], ["all", "All"]] as const).map(([key, label]) => (<ActionButton key={key} primary={cancellationFilter === key} selected={cancellationFilter === key} onClick={() => { setCancellationFilter(key); setVisibleLimit(12); }}>{label}</ActionButton>))}
          </div>
          {visibleCancellations.length === 0 && <div style={cardStyle}><p style={{ color: muted, margin: 0, lineHeight: 1.8 }}>{cancellationFilter === "pending" ? "No pending cancellation requests." : "No cancellation requests in this category."}</p></div>}
          <div style={{ display: "grid", gap: 20 }}>
            {visibleCancellations.slice(0, visibleLimit).map(request => {
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
                            : "Approving cancels this reservation and releases its dates, subject to other blocks. Declining keeps the reservation confirmed. Approval queues a client cancellation email. Declining sends no email. Neither action processes a refund."}</p>
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
          {visibleCancellations.length > visibleLimit && <ActionButton disabled={locked} onClick={() => setVisibleLimit(v => v + 12)}>Show more cancellation requests</ActionButton>}
          <p style={{ color: muted, fontSize: 13, marginTop: 26, lineHeight: 1.8 }}>Eligible bookings: confirmed live reservations and approved test bookings. Pending requests, rejected bookings, cancelled bookings and availability blocks cannot enter this cancellation workflow.</p>
        </>)}
      {!loading && !error && snapshot && <RentalNotificationStatus refreshKey={`${updated}:${busy ?? "idle"}`} />}
    </div>);
}
