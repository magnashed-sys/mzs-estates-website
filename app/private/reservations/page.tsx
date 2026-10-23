"use client";
import {useLocale, useTranslations} from "next-intl";
import {isLocale, localizedPath} from "../../../i18n/public-routing";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, } from "react";
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
    quoted_total_eur: number | string | null;
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
    id: string;
    booking_id: string;
    reason: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
};
type Snapshot = {
    bookings: Booking[];
    projects: Project[];
    configurations: Configuration[];
    cancellations: Cancellation[];
};
type Notice = {
    kind: "success" | "error";
    text: string;
};
const gold = "#d5c09a";
const muted = "#aaa59b";
const border = "#403a30";
const warning = "#e4a999";
// Keep this exact eligibility rule aligned with both cancellation RPCs
// and BookingManagement.tsx. A TEST record is never converted to LIVE.
function isCancellationEligible(booking: Booking): boolean {
    return ((booking.is_test === true && booking.status === "test_approved") ||
        (booking.is_test === false && booking.status === "confirmed"));
}
const buttonStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: `1px solid ${gold}`, background: "transparent", color: gold,
    padding: "13px 19px", fontSize: 12, letterSpacing: ".08em",
    lineHeight: 1.5, fontFamily: "inherit", textDecoration: "none", cursor: "pointer",
};
const rowStyle: CSSProperties = {
    display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12,
};
export default function MyReservationsPage() {
    const t = useTranslations("MemberUI");
    const locale = useLocale();
    const formatLocale = locale === "en" ? "en-GB" : locale;
    function formatDate(value: string): string {
        const date = new Date(`${value}T12:00:00Z`);
        return Number.isNaN(date.getTime()) ? t("dateUnavailable") : date.toLocaleDateString(formatLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    }
    function formatTimestamp(value: string | null): string {
        if (!value)
            return t("awaitingReview");
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? t("dateUnavailable") : date.toLocaleString(formatLocale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    function formatMoney(value: number | string | null): string {
        if (value === null || !Number.isFinite(Number(value)))
            return t("priceUnavailable");
        return new Intl.NumberFormat(formatLocale, { style: "currency", currency: "EUR" }).format(Number(value));
    }
    function statusLabel(value: string): string {
        return t.has(`statuses.${value}`) ? t(`statuses.${value}`) : t("statusUnknown");
    }
    function errorText(value: unknown): string {
        const message = typeof value === "object" && value !== null && "message" in value &&
            typeof value.message === "string" ? value.message : "";
        const known: Record<string, string> = {
            "Cancellation already requested": t("aCancellationRequestIsAlreadyAwaitingMzsReview"),
            "Booking is not eligible for cancellation request": t("thisBookingIsNotCurrentlyEligibleForA"),
            "Please provide a reason (5-2000 characters)": t("pleaseProvideAReasonBetween5And2000"),
            "Request cannot be withdrawn": t("thisRequestIsNoLongerAwaitingApprovalAnd"),
            "Access denied": t("yourAccessCouldNotBeVerifiedPleaseSign"),
        };
        return known[message] ?? t("theOutcomeCouldNotBeConfirmedRefreshAnd");
    }

    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [reasonId, setReasonId] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [notice, setNotice] = useState<Notice | null>(null);
    const [error, setError] = useState("");
    const mounted = useRef(false);
    const loadVersion = useRef(0);
    const mutationInProgress = useRef(false);
    const load = useCallback(async (): Promise<boolean> => {
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
            if (authError || !auth.user) {
                setSnapshot(null);
                window.location.assign(localizedPath("/login", isLocale(locale) ? locale : "en"));
                return false;
            }
            const { data: profile, error: profileError } = await supabase
                .from("profiles").select("role,is_active").eq("id", auth.user.id).single();
            if (!current())
                return false;
            if (profileError || profile?.is_active !== true || !["client", "partner"].includes(profile.role)) {
                throw new Error(t("yourAccountIsNotAuthorizedToViewThese"));
            }
            // Limit both queries to the authenticated owner. Database RLS remains in force.
            const [bookingResult, cancellationResult] = await Promise.all([
                supabase.from("rental_bookings")
                    .select("id,project_id,rental_configuration_id,check_in,check_out,guest_count,status,is_test,quoted_total_eur,created_at", { count: "exact" })
                    .eq("user_id", auth.user.id).order("created_at", { ascending: false }),
                supabase.from("rental_cancellation_requests")
                    .select("id,booking_id,reason,status,created_at,reviewed_at", { count: "exact" })
                    .eq("user_id", auth.user.id).order("created_at", { ascending: false }),
            ]);
            if (!current())
                return false;
            if (bookingResult.error || cancellationResult.error) {
                throw new Error(t("unableToLoadYourReservationsAndCancellationHistory"));
            }
            if ([bookingResult, cancellationResult].some(result => result.count !== null && result.count > (result.data?.length ?? 0))) {
                throw new Error(t("yourHistoryExceedsTheCurrentLoadingLimitPlease"));
            }
            const bookings = (bookingResult.data ?? []) as Booking[];
            const cancellations = (cancellationResult.data ?? []) as Cancellation[];
            const projectIds = [...new Set(bookings.map(booking => booking.project_id))];
            const configurationIds = [...new Set(bookings.map(booking => booking.rental_configuration_id)
                    .filter((id): id is string => Boolean(id)))];
            let projects: Project[] = [];
            let configurations: Configuration[] = [];
            if (projectIds.length > 0) {
                const result = await supabase.from("projects").select("id,title,slug", { count: "exact" }).in("id", projectIds);
                if (!current())
                    return false;
                if (result.error)
                    throw new Error(t("unableToLoadPropertyDetailsPleaseRefresh"));
                if (result.count !== null && result.count > (result.data?.length ?? 0))
                    throw new Error(t("unableToLoadTheFullPropertyOverview"));
                projects = (result.data ?? []) as Project[];
            }
            if (configurationIds.length > 0) {
                const result = await supabase.from("rental_configurations").select("id,title", { count: "exact" }).in("id", configurationIds);
                if (!current())
                    return false;
                if (result.error)
                    throw new Error(t("unableToLoadRentalConfigurationDetailsPleaseRefresh"));
                if (result.count !== null && result.count > (result.data?.length ?? 0))
                    throw new Error(t("unableToLoadAllRentalConfigurations"));
                configurations = (result.data ?? []) as Configuration[];
            }
            // A removed project permission may return no project/configuration rows;
            // the client's own booking history is still retained with a fallback label.
            if (!current())
                return false;
            setSnapshot({ bookings, cancellations, projects, configurations });
            return true;
        }
        catch (cause) {
            if (current()) {
                setSnapshot(null);
                setError(cause instanceof Error ? cause.message : t("unableToLoadReservationsPleaseRefresh"));
            }
            return false;
        }
        finally {
            if (current())
                setLoading(false);
        }
    }, [t, locale]);
    useEffect(() => {
        mounted.current = true;
        void load();
        return () => { mounted.current = false; loadVersion.current += 1; };
    }, [load]);
    async function mutate(booking: Booking, functionName: "withdraw_rental_request" | "request_booking_cancellation", args: Record<string, string>, success: string) {
        if (mutationInProgress.current || loading || error || !snapshot)
            return;
        mutationInProgress.current = true;
        setBusyId(booking.id);
        setNotice(null);
        try {
            const { data, error: rpcError } = await createClient().rpc(functionName, args);
            if (rpcError)
                throw rpcError;
            const confirmed = functionName === "withdraw_rental_request" ? data === true :
                typeof data === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data);
            if (!confirmed)
                throw new Error("Unexpected result");
            if (mounted.current) {
                setReasonId(null);
                setReason("");
            }
            const refreshed = await load();
            if (mounted.current)
                setNotice({
                    kind: refreshed ? "success" : "error",
                    text: refreshed ? success : t("refreshAfterSuccess", {message: success}),
                });
        }
        catch (cause) {
            const text = errorText(cause);
            await load(); // Refresh once; never repeat a mutation automatically.
            if (mounted.current)
                setNotice({ kind: "error", text });
        }
        finally {
            mutationInProgress.current = false;
            if (mounted.current)
                setBusyId(null);
        }
    }
    function withdraw(booking: Booking) {
        if (mutationInProgress.current || booking.status !== "requested")
            return;
        if (!window.confirm(t("withdrawConfirm", {start: formatDate(booking.check_in), end: formatDate(booking.check_out)})))
            return;
        void mutate(booking, "withdraw_rental_request", { p_booking_id: booking.id }, t("yourBookingRequestHasBeenWithdrawn"));
    }
    function requestCancellation(event: FormEvent<HTMLFormElement>, booking: Booking) {
        event.preventDefault();
        if (mutationInProgress.current || !isCancellationEligible(booking))
            return;
        if (snapshot?.cancellations.some(request => request.booking_id === booking.id && request.status === "pending"))
            return;
        const text = reason.trim();
        if (text.length < 5 || text.length > 2000) {
            setNotice({ kind: "error", text: t("pleaseProvideAReasonBetween5And2000") });
            return;
        }
        const explanation = booking.is_test
            ? t("thisIsATestCancellationRequestNoReal")
            : t("theReservationRemainsConfirmedUntilMzsApprovesYour");
        if (!window.confirm(t("cancelConfirm", {explanation})))
            return;
        void mutate(booking, "request_booking_cancellation", { p_booking_id: booking.id, p_reason: text }, booking.is_test
            ? t("yourTestCancellationRequestHasBeenSentTo")
            : t("yourCancellationRequestHasBeenSentToMzs"));
    }
    const locked = loading || busyId !== null || Boolean(error);
    const disabledStyle: CSSProperties = { ...buttonStyle, opacity: locked ? 0.5 : 1, cursor: locked ? "not-allowed" : "pointer" };
    return (<main style={{ minHeight: "100vh", background: "#0b0b0a", color: "#eeeae2", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ ...rowStyle, justifyContent: "space-between", padding: "25px clamp(22px,5vw,80px)", borderBottom: `1px solid ${border}` }}>
        <a href={localizedPath("/", isLocale(locale) ? locale : "en")} style={{ color: gold, textDecoration: "none", fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".13em" }}>MZS GROUP</a>
        <Link href="/private" style={{ color: gold, fontSize: 12, textDecoration: "none" }}>{t("privateCollectionLabel")}</Link>
      </header>

      <section style={{ maxWidth: 1150, margin: "0 auto", padding: "65px 24px 110px" }}>
        <p style={{ color: gold, letterSpacing: ".2em", fontSize: 12 }}>{t("mzsPrivateCollection")}</p>
        <div style={{ ...rowStyle, justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(38px,5vw,64px)", fontWeight: 400, margin: "18px 0" }}>{t("myReservations")}</h1>
          <button type="button" style={{ ...buttonStyle, opacity: loading || busyId !== null ? 0.5 : 1, cursor: loading || busyId !== null ? "not-allowed" : "pointer" }} disabled={loading || busyId !== null} onClick={() => void load()}>{t("refreshReservations")}</button>
        </div>
        <p style={{ color: muted, lineHeight: 1.8 }}>{t("viewYourPrivateStaysAndManageBookingRequests")}</p>
        {error && <p role="alert" style={{ color: warning, lineHeight: 1.8 }}>{error}</p>}
        {notice && <p role={notice.kind === "error" ? "alert" : "status"} style={{ color: notice.kind === "error" ? warning : gold, lineHeight: 1.8 }}>{notice.text}</p>}
        {loading && <p role="status" style={{ color: muted, marginTop: 45 }}>{t("loadingReservations")}</p>}

        {!loading && !error && snapshot && snapshot.bookings.length === 0 && (<article style={{ marginTop: 45, padding: 35, border: `1px solid ${border}` }}>
            <h2 style={{ fontFamily: "Georgia, serif" }}>{t("noReservationsYet")}</h2>
            <p style={{ color: muted }}>{t("yourFutureStaysAndBookingRequestsWillAppear")}</p>
            <Link href="/private" style={{ color: gold }}>{t("explorePrivateCollection")}</Link>
          </article>)}

        {!loading && !error && snapshot && snapshot.bookings.length > 0 && (<div style={{ display: "grid", gap: 22, marginTop: 45 }}>
            {snapshot.bookings.map(booking => {
                const project = snapshot.projects.find(item => item.id === booking.project_id);
                const configuration = snapshot.configurations.find(item => item.id === booking.rental_configuration_id);
                const history = snapshot.cancellations.filter(item => item.booking_id === booking.id);
                const pendingCancellation = history.some(item => item.status === "pending");
                const eligible = isCancellationEligible(booking);
                const showForm = reasonId === booking.id && eligible && !pendingCancellation;
                const fields = [
                    [t("checkin"), formatDate(booking.check_in)],
                    [t("checkout"), formatDate(booking.check_out)],
                    [t("guests"), String(booking.guest_count ?? "—")],
                    [t("quotedTotal"), formatMoney(booking.quoted_total_eur)],
                ];
                return (<article key={booking.id} style={{ padding: "clamp(22px,4vw,38px)", background: "#171613", border: `1px solid ${border}` }}>
                  <p style={{ color: gold, fontSize: 12, letterSpacing: ".14em", lineHeight: 1.6 }}>
                    {booking.is_test ? t("testBooking") : t("privateRental")} · {statusLabel(booking.status)}
                  </p>
                  <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 32 }}>{project?.title ?? t("privateProperty")}</h2>
                  {configuration && <p style={{ color: muted }}>{configuration.title}</p>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 25, margin: "30px 0" }}>
                    {fields.map(([label, value]) => (<div key={label}><p style={{ color: muted, fontSize: 12 }}>{label}</p><strong>{value}</strong></div>))}
                  </div>
                  {booking.is_test && <p style={{ color: muted, fontSize: 13, lineHeight: 1.8 }}>{t("pilotOnlyThisTestBookingDoesNotReserve")}</p>}
                  <div style={rowStyle}>
                    {project && <Link href={`/private/projects/${encodeURIComponent(project.slug)}`} style={buttonStyle}>{t("viewProperty")}</Link>}
                    {booking.status === "requested" && <button type="button" style={disabledStyle} disabled={locked} onClick={() => withdraw(booking)}>{t("withdrawRequest")}</button>}
                    {eligible && !pendingCancellation && !showForm && (<button type="button" style={disabledStyle} disabled={locked} onClick={() => { setReasonId(booking.id); setReason(""); setNotice(null); }}>
                        {booking.is_test ? t("requestTestCancellation") : t("requestCancellation")}
                      </button>)}
                  </div>
                  {pendingCancellation && <p style={{ color: gold, lineHeight: 1.8 }}>
                    {booking.is_test
                            ? t("testCancellationRequestAwaitingMzsReviewThisRemains")
                            : t("cancellationRequestAwaitingMzsReviewYourReservationRemains")}
                  </p>}
                  {showForm && (<form style={{ marginTop: 28 }} onSubmit={event => requestCancellation(event, booking)}>
                      <p style={{ color: muted, lineHeight: 1.8 }}>
                        {booking.is_test
                            ? t("testCancellationOnlyYouArePractisingTheCancellation")
                            : t("mzsReviewsEachCancellationPersonallyNoRefundIs")}
                      </p>
                      <label htmlFor={`reason-${booking.id}`}>{t("reasonForCancellation")}</label>
                      <textarea id={`reason-${booking.id}`} value={reason} minLength={5} maxLength={2000} rows={4} required disabled={locked} onChange={event => setReason(event.target.value)} style={{ display: "block", boxSizing: "border-box", width: "100%", background: "#0b0b0a", border: `1px solid ${border}`, color: "#eeeae2", padding: 15, margin: "12px 0", fontSize: 16, fontFamily: "inherit", lineHeight: 1.6 }}/>
                      <div style={rowStyle}>
                        <button type="submit" style={disabledStyle} disabled={locked}>
                          {busyId === booking.id ? t("sending") : booking.is_test ? t("sendTestCancellationRequest") : t("sendCancellationRequest")}
                        </button>
                        <button type="button" style={disabledStyle} disabled={locked} onClick={() => { setReasonId(null); setReason(""); }}>{t("close")}</button>
                      </div>
                    </form>)}
                  {history.length > 0 && (<section aria-label={t("cancellationHistory")} style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${border}` }}>
                      <h3 style={{ fontSize: 14, fontWeight: 400, color: gold, letterSpacing: ".12em" }}>{t("cancellationHistoryLabel")}</h3>
                      {history.map(request => (<div key={request.id} style={{ marginTop: 18, padding: 18, border: `1px solid ${border}` }}>
                          <p style={{ color: gold, fontSize: 12, marginTop: 0 }}>{booking.is_test ? "TEST · " : ""}{statusLabel(request.status)}</p>
                          <p style={{ color: muted, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{request.reason}</p>
                          <p style={{ color: muted, fontSize: 12, lineHeight: 1.8 }}>{t("requested")} {formatTimestamp(request.created_at)}{request.reviewed_at ? t("reviewedAt", {date: formatTimestamp(request.reviewed_at)}) : ""}</p>
                          <p style={{ color: muted, fontSize: 13, lineHeight: 1.8, marginBottom: 0 }}>
                            {request.status === "pending"
                                ? t("awaitingMzsReviewTheCancellationIsNotYet")
                                : request.status === "approved"
                                    ? booking.is_test ? t("mzsApprovedThisTestCancellationNoRealReservation") : t("mzsApprovedThisCancellationAnyFinancialArrangementsAre")
                                    : t("mzsDeclinedThisCancellationRequestThatDecisionDid")}
                          </p>
                        </div>))}
                    </section>)}
                </article>);
            })}
          </div>)}
      </section>
    </main>);
}
