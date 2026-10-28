import {allocateCostCents} from "./finance";

export type ExpenseAllocationMode = "property" | "unit" | "equal-units";

export type AllocationPreview = {
  targetId: string;
  netCents: number;
  vatCents: number;
  grossCents: number;
};

/** For preview only: never used to establish a legal-property association. */
export function inputEuroCents(raw: string): number {
  if (typeof raw !== "string" || !/^\d{1,9}([,.]\d{1,2})?$/.test(raw.trim())) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }
  const [euros, decimals = ""] = raw.trim().replace(",", ".").split(".");
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000_000) {
    throw new Error("Amount is too high.");
  }
  return cents;
}

export function expenseAllocationPreview(
  netCents: number,
  vatCents: number,
  mode: ExpenseAllocationMode,
  propertyId: string,
  availableUnitIds: readonly string[],
  chosenUnitId?: string
): AllocationPreview[] {
  if (!propertyId || typeof propertyId !== "string") throw new Error("Select a property.");
  const uniqueUnits = [...new Set(availableUnitIds)];
  if (uniqueUnits.length !== availableUnitIds.length) {
    throw new Error("Dubbele units in objectregister.");
  }
  const targets = mode === "property" ? [propertyId] :
    mode === "unit" ?
      (chosenUnitId && uniqueUnits.includes(chosenUnitId) ? [chosenUnitId] : []) :
      mode === "equal-units" ? uniqueUnits.slice().sort() : [];
  if (!targets.length) throw new Error("Select a valid unit or choose the entire property.");
  if (targets.length > 100) throw new Error("Too many units for one allocation.");

  const base = Math.floor(10000 / targets.length);
  const remainder = 10000 % targets.length;
  const shares = targets.map((targetId, index) => ({
    reference: targetId,
    basisPoints: base + (index < remainder ? 1 : 0),
  }));
  const net = allocateCostCents(netCents, shares);
  const vat = allocateCostCents(vatCents, shares);
  return net.map((r, i) => ({
    targetId: r.reference,
    netCents: r.amountCents,
    vatCents: vat[i].amountCents,
    grossCents: r.amountCents + vat[i].amountCents,
  }));
}
