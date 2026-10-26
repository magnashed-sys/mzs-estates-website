import BookingDossier from "../../unified-bookings/[id]/page";

/** Preserve existing audited booking actions while exposing canonical /admin/bookings/:id. */
export const dynamic = "force-dynamic";
export default BookingDossier;
