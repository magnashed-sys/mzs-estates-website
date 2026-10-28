/**
 * Property Operations accounting preparation: pure calculations only.
 * Financial sources and legal tax treatment must be approved upstream.
 * Never infer the legal entity, VAT rate, or customer from a free-text label.
 */
export type WorkBillingRule = { minimumMinutes: number; incrementMinutes: number };
export type CostShare = { reference: string; basisPoints: number };
export type CostAllocation = { reference: string; amountCents: number };

const MAX_CENTS = 100_000_000_000;
function safeCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new Error('Amount must be a nonnegative integer number of cents');
  }
}

/** Round each approved visit separately; never round a weekly total. */
export function roundedBillableMinutes(actualMinutes: number, rule: WorkBillingRule): number {
  if (!Number.isSafeInteger(actualMinutes) || actualMinutes <= 0 || actualMinutes > 60 * 24 * 31) {
    throw new Error('Actual worked minutes must be a positive integer');
  }
  if (!Number.isSafeInteger(rule.minimumMinutes) || rule.minimumMinutes < 0 ||
      !Number.isSafeInteger(rule.incrementMinutes) || rule.incrementMinutes <= 0) {
    throw new Error('Invalid minimum or rounding increment');
  }
  const result = Math.max(rule.minimumMinutes,
    Math.ceil(actualMinutes / rule.incrementMinutes) * rule.incrementMinutes);
  if (!Number.isSafeInteger(result)) throw new Error('Billable duration overflow');
  return result;
}

/** Rates are explicit contractual snapshots, never inferred from previous receipts. */
export function hourlyChargeCents(billableMinutes: number, rateCentsPerHour: number): number {
  if (!Number.isSafeInteger(billableMinutes) || billableMinutes <= 0 || billableMinutes > 60 * 24 * 31) {
    throw new Error('Invalid billable minutes');
  }
  safeCents(rateCentsPerHour);
  const charge = Math.round(billableMinutes * rateCentsPerHour / 60);
  safeCents(charge);
  return charge;
}

/** VAT rate is provided by reviewed invoice data: 2100 = 21%, 0 = exempt/zero as selected. */
export function invoiceTotalsFromNetCents(netCents: number, vatBasisPoints: number) {
  safeCents(netCents);
  if (!Number.isSafeInteger(vatBasisPoints) || vatBasisPoints < 0 || vatBasisPoints > 10000) {
    throw new Error('Invalid VAT rate in basis points');
  }
  const vatCents = Number((BigInt(netCents) * BigInt(vatBasisPoints) + BigInt(5000)) / BigInt(10000));
  const grossCents = netCents + vatCents;
  safeCents(grossCents);
  return { netCents, vatCents, grossCents };
}

/** Split one expense into parts without double-counting or losing a cent. */
export function allocateCostCents(totalCents: number, shares: readonly CostShare[]): CostAllocation[] {
  safeCents(totalCents);
  if (!Array.isArray(shares) || shares.length < 1 || shares.length > 100) {
    throw new Error('At least one and no more than 100 allocation shares are required');
  }
  const used = new Set<string>();
  let totalBasisPoints = 0;
  for (const share of shares) {
    if (!share || typeof share.reference !== 'string' || !share.reference.trim() ||
        share.reference.length > 200 || used.has(share.reference)) {
      throw new Error('Every allocation reference must be unique and nonempty');
    }
    used.add(share.reference);
    if (!Number.isSafeInteger(share.basisPoints) || share.basisPoints < 0 || share.basisPoints > 10000) {
      throw new Error('Allocation percentages must be integer basis points');
    }
    totalBasisPoints += share.basisPoints;
  }
  if (totalBasisPoints !== 10000) throw new Error('Cost allocations must total exactly 100%');
  const basis = BigInt(10000);
  const rows = shares.map(share => {
    const numerator = BigInt(totalCents) * BigInt(share.basisPoints);
    return { reference: share.reference, amountCents: Number(numerator / basis),
      remainder: Number(numerator % basis) };
  });
  const pennies = totalCents - rows.reduce((sum, row) => sum + row.amountCents, 0);
  const ranked = rows.slice().sort((a, b) => b.remainder - a.remainder ||
    a.reference.localeCompare(b.reference, 'en'));
  for (let i = 0; i < pennies; i++) ranked[i].amountCents += 1;
  return rows.map(({ reference, amountCents }) => ({ reference, amountCents }));
}

/** Escaped spreadsheet-safe CSV for a separately authorised accountant export endpoint. */
export function accountantCsv(fields: readonly string[], records: readonly Record<string, unknown>[]): string {
  if (!Array.isArray(fields) || !fields.length || fields.length > 100 || new Set(fields).size !== fields.length ||
    fields.some(name => typeof name !== 'string' || !name || name.length > 120)) {
    throw new Error('Invalid accountant export columns');
  }
  if (!Array.isArray(records) || records.length > 100000) throw new Error('Invalid accountant export rows');
  function cell(value: unknown): string {
    if (value === null || value === undefined) return '""';
    if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
      throw new Error('Unsupported accountant export field type');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid export number');
    const raw = String(value);
    const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  }
  const lines = [fields.map(cell).join(',')];
  for (const row of records) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid accountant export row');
    if (fields.some(f => !Object.prototype.hasOwnProperty.call(row, f))) {
      throw new Error('Incomplete accountant export row');
    }
    lines.push(fields.map(f => cell(row[f])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
