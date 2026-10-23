export type InvitationLike = { status: string };
export type RequestFilter = "pending" | "approved" | "invitations" | "declined" | "all";

export function requestStage(status: string, invitation?: InvitationLike): string {
  if (!invitation) return status;
  if (invitation.status === "completed") return "registered";
  if (invitation.status === "sent") return "invited";
  return "needs_review";
}

export function matchesRequestFilter(status: string, invitation: InvitationLike | undefined, filter: RequestFilter): boolean {
  if (filter === "all") return true;
  if (filter === "invitations") return Boolean(invitation);
  return !invitation && status === filter;
}

export function matchesSearch(query: string, ...values: (string | null | undefined)[]): boolean {
  const text = values.filter(Boolean).join(" ").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}

export function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((id, index) => id === sortedB[index]);
}

export function todayInMadrid(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export type CalendarBooking = {
  id: string; project_id: string; check_in: string; check_out: string; status: string; is_test: boolean;
};

// Checkout is exclusive: a departing stay does not occupy that night's slot.
export function occupiedOn(booking: CalendarBooking, day: string): boolean {
  return !booking.is_test && ["confirmed", "blocked"].includes(booking.status)
    && booking.check_in <= day && day < booking.check_out;
}

export function liveArrivals<T extends CalendarBooking>(bookings: T[], today: string, months = 3): T[] {
  const date = new Date(`${today}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  const end = date.toISOString().slice(0, 10);
  return bookings.filter(booking => !booking.is_test && booking.status === "confirmed"
    && booking.check_in >= today && booking.check_in < end)
    .sort((a, b) => a.check_in.localeCompare(b.check_in) || a.id.localeCompare(b.id));
}

export function assertComplete(results: { error: unknown; count?: number | null; data: unknown[] | null }[]): void {
  if (results.some(result => result.error)) throw new Error("Unable to load administration records. Please refresh.");
  if (results.some(result => result.count != null && result.count > (result.data?.length ?? 0))) {
    throw new Error("The records exceed the current loading limit. The overview is incomplete and actions are unavailable. Contact your administrator to enable database pagination.");
  }
}
