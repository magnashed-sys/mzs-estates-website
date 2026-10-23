export type RentUnit = { monthly_rent: number | string; utilities_advance: number | string | null };

// Sum cents, not binary floating-point currency; unknown advances stay unknown.
export function rentSummary(units: RentUnit[]) {
  const monthlyCents = units.reduce((total, unit) => total + Math.round(Number(unit.monthly_rent) * 100), 0);
  const advancesKnown = units.length > 0 && units.every(unit => unit.utilities_advance !== null);
  return {
    monthly: monthlyCents / 100,
    annual: monthlyCents * 12 / 100,
    utilitiesAdvance: advancesKnown
      ? units.reduce((total, unit) => total + Math.round(Number(unit.utilities_advance) * 100), 0) / 100
      : null,
  };
}

export const euros = (value: number | string) => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
}).format(Number(value));
