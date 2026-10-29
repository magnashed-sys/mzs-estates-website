"use client";
import {useAdminI18n} from '../../lib/admin/i18n';


import { useState } from "react";
import { occupiedOn, todayInMadrid, type CalendarBooking } from "./admin-model";

export default function RentalSchedule({ bookings, properties }: {
  bookings: CalendarBooking[]; properties: { id: string; title: string }[];
}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const [month, setMonth] = useState(() => todayInMadrid().slice(0, 7));
  const [propertyId, setPropertyId] = useState("all");
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1, 12));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const title = first.toLocaleDateString(adminLocale, { month: "long", year: "numeric", timeZone: "UTC" });
  // One calendar per physical property, regardless of its rental configurations.
  const shown = properties.filter(p => propertyId === "all" || p.id === propertyId);
  function move(amount: number) {
    setMonth(new Date(Date.UTC(year, number - 1 + amount, 1, 12)).toISOString().slice(0, 7));
  }
  return <section aria-label={adminT("Rental calendar")}>
    <div className="admin-toolbar">
      <label className="admin-field">{adminT("Property")}<select value={propertyId} onChange={event => setPropertyId(event.target.value)}>
        <option value="all">{adminT("All rental properties")}</option>
        {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select></label>
      <div className="admin-actions">
        <button className="admin-button" type="button" onClick={() => move(-1)} aria-label={adminT("Previous month")}>←</button>
        <button className="admin-button" type="button" onClick={() => setMonth(todayInMadrid().slice(0, 7))}>{adminT("This month")}</button>
        <button className="admin-button" type="button" onClick={() => move(1)} aria-label={adminT("Next month")}>→</button>
      </div>
    </div>
    <h3 className="admin-subtitle" aria-live="polite">{title}</h3>
    <p className="admin-help">{adminT("Confirmed stays and availability blocks only. Each cell represents the night starting on that date. Pending requests and tests do not reserve nights.")}</p>
    <div className="admin-calendar-legend"><span>{adminT("Free in recorded bookings")}</span><span className="is-booked">{adminT("Confirmed")}</span><span className="is-blocked">{adminT("Blocked")}</span></div>
    {!shown.length && <p className="admin-empty">{adminT("No rental properties are available in this overview.")}</p>}
    <div className="admin-calendar-list">{shown.map(property => <article key={property.id} className="admin-panel">
      <h3 className="admin-subtitle">{property.title}</h3>
      <div className="admin-calendar" role="table" aria-label={adminT("{p0}, {p1}", {p0: property.title, p1: title})}>
        <div role="row" className="admin-calendar-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <div role="columnheader" key={day}>{day}</div>)}</div>
        {Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => <div role="row" className="admin-calendar-row" key={week}>
          {Array.from({ length: 7 }, (_, column) => {
            const day = week * 7 + column - offset + 1;
            if (day < 1 || day > days) return <div role="cell" key={column} />;
            const iso = `${month}-${String(day).padStart(2, "0")}`;
            const hits = bookings.filter(b => b.project_id === property.id && occupiedOn(b, iso));
            const confirmed = hits.some(b => b.status === "confirmed");
            const blocked = hits.some(b => b.status === "blocked");
            const label = confirmed && blocked ? "Confirmed and blocked" : confirmed ? "Confirmed" : blocked ? "Blocked" : "Free in recorded bookings";
            return <div key={column} role="cell" className={`admin-calendar-day ${confirmed ? "is-booked" : blocked ? "is-blocked" : ""}`} title={adminT("{p0}: {p1}", {p0: iso, p1: label})} aria-label={adminT("{p0}: {p1}", {p0: iso, p1: label})}><strong>{day}</strong>{hits.length > 0 && <span>{confirmed ? adminT("Stay") : adminT("Block")}</span>}</div>;
          })}
        </div>)}
      </div>
    </article>)}</div>
  </section>;
}
