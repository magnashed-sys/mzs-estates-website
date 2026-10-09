1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
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
