/**
 * Property Operations — purchase expense intake model.
 *
 * Pure preparation model. No DB access, uploads, invoice issue or tax decision.
 * Callers MUST resolve verified legal-entity/property links and unit ownership
 * from the server-side database; never trust the browser for access rights.
 */
export const expenseCategories = [
  'electricity','gas','water','cleaning','internet','insurance',
  'taxes','maintenance','materials','management','other',
] as const;

export type ExpenseCategory = typeof expenseCategories[number];

export type PropertyShare = {
  propertyId: string;
  unitId?: string | null;
  basisPoints: number; // per line: exactly 10000
};

export type ExpenseLineInput = {
  category: ExpenseCategory;
  description: string;
  netCents: number;
  vatCents: number; // explicitly read from supplier's invoice, NOT derived from a guessed rate
  shares: readonly PropertyShare[];
};

export type PurchaseExpenseInput = {
  legalEntityId: string;
  supplierRelationshipId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  currency: string;
  sourceSha256: string | null; // a draft may lack evidence; approval must not
  lines: readonly ExpenseLineInput[];
};

export type VerifiedPropertyScope = {
  /** Server-confirmed properties to which the chosen paying legal entity is linked. */
  propertyIds: ReadonlySet<string>;
  /** Server-confirmed unit => parent property lookup for allocation validation. */
  unitProperties: Readonly<Record<string, string>>;
};

export type NormalisedAllocation = {
  propertyId: string;
  unitId: string | null;
  basisPoints: number;
  netCents: number;
  vatCents: number;
  grossCents: number;
};

export type NormalisedExpenseLine = {
  category: ExpenseCategory;
  description: string;
  netCents: number;
  vatCents: number;
  grossCents: number;
  allocations: NormalisedAllocation[];
};

export type NormalisedExpense = {
  legalEntityId: string;
  supplierRelationshipId: string;
  supplierInvoiceNumber: string;
  identityKey: string;
  invoiceDate: string;
  dueDate: string | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  currency: 'EUR';
  sourceSha256: string | null;
  requiresDocument: boolean;
  totals: { netCents: number; vatCents: number; grossCents: number };
  lines: NormalisedExpenseLine[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(value: string, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error('Invalid ' + label);
  }
  return value.toLowerCase();
}

const MAX_CENTS = 100_000_000_000;
function amount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new Error('Invoice amounts must be nonnegative integer cents');
  }
  return value;
}
function sumCents(values: number[]): number {
  return amount(values.reduce((a,b) => a + amount(b), 0));
}

function requireDate(value: string, label: string): string {
  if (typeof value !== 'string' || !/^(20\d{2}|2100)-(0[1-9]|1[0-2])-\d{2}$/.test(value)) {
    throw new Error('Invalid ' + label);
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10) !== value) {
    throw new Error('Invalid ' + label);
  }
  return value;
}

function normalizedInvoiceReference(original: string): string {
  if (typeof original !== 'string') throw new Error('Supplier invoice number required');
  const number = original.trim();
  if (number.length < 1 || number.length > 100 ||
    /[\u0000-\u001f\u007f]/u.test(number)) throw new Error('Invalid supplier invoice number');
  return number;
}

/** Duplicate identity is scoped by BOTH legal entity and supplier. */
export function purchaseExpenseIdentityKey(entityId: string, supplierId: string, invoiceNo: string): string {
  return requireUuid(entityId,'legal entity') + '|' +
    requireUuid(supplierId,'supplier relationship') + '|' +
    normalizedInvoiceReference(invoiceNo).replace(/\s+/gu, ' ').toUpperCase();
}

/**
 * Largest-remainder split: exact cents conservation, deterministic on scope key.
 * Expects unique allocation keys and exactly 10000 basis points.
 */
function splitCents(total: number, rows: readonly { key: string; basisPoints: number }[]): Map<string, number> {
  amount(total);
  const calculated = rows.map(row => {
    const dividend = BigInt(total) * BigInt(row.basisPoints);
    return { key: row.key, base: Number(dividend / 10000n),
      remainder: Number(dividend % 10000n) };
  });
  let pennies = total - calculated.reduce((s,x) => s + x.base, 0);
  const winners = [...calculated].sort((a,b) => b.remainder - a.remainder ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (let i=0;i<pennies;i++) winners[i].base += 1;
  return new Map(calculated.map(x => [x.key,x.base]));
}

export function normalizePurchaseExpense(input: PurchaseExpenseInput, verified: VerifiedPropertyScope): NormalisedExpense {
  if (!input || !verified || !(verified.propertyIds instanceof Set) ||
    !verified.unitProperties || typeof verified.unitProperties !== 'object') {
    throw new Error('Verified property/entity scope is required');
  }
  const legalEntityId = requireUuid(input.legalEntityId,'legal entity');
  const supplierRelationshipId = requireUuid(input.supplierRelationshipId,'supplier relationship');
  const supplierInvoiceNumber = normalizedInvoiceReference(input.supplierInvoiceNumber);
  const invoiceDate = requireDate(input.invoiceDate,'invoice date');
  const dueDate = input.dueDate === null ? null : requireDate(input.dueDate,'due date');
  const from = input.servicePeriodStart === null ? null : requireDate(input.servicePeriodStart,'service start');
  const through = input.servicePeriodEnd === null ? null : requireDate(input.servicePeriodEnd,'service end');
  if ((from === null) !== (through === null)) throw new Error('Service period dates must be supplied together');
  if (from !== null && through !== null && through < from) throw new Error('Service period is reversed');
  // First delivery is EUR only. Future currencies need conversion & local tax review.
  if (input.currency !== 'EUR') throw new Error('First-phase purchase expenses require EUR currency');
  let sourceSha256: string | null = null;
  if (input.sourceSha256 !== null) {
    if (typeof input.sourceSha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(input.sourceSha256)) {
      throw new Error('Invalid source document hash');
    }
    sourceSha256 = input.sourceSha256.toLowerCase();
  }
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 60) {
    throw new Error('A purchase expense requires 1–60 cost lines');
  }
  const lines: NormalisedExpenseLine[] = input.lines.map(line => {
    if (!line || !expenseCategories.includes(line.category)) throw new Error('Invalid cost category');
    const description = typeof line.description === 'string' ? line.description.trim() : '';
    if (description.length < 2 || description.length > 500 || /[\u0000-\u001f\u007f]/u.test(description)) {
      throw new Error('Invalid cost description');
    }
    const netCents = amount(line.netCents), vatCents = amount(line.vatCents);
    const grossCents = sumCents([netCents,vatCents]);
    if (grossCents === 0) throw new Error('Zero-value lines cannot be submitted');
    if (!Array.isArray(line.shares) || !line.shares.length || line.shares.length > 100) {
      throw new Error('Each cost line needs 1–100 object allocations');
    }
    const seen = new Set<string>();
    let basisPoints = 0;
    const scopes = line.shares.map(share => {
      const propertyId = requireUuid(share.propertyId,'property');
      const unitId = share.unitId === null || share.unitId === undefined ? null : requireUuid(share.unitId,'unit');
      if (!verified.propertyIds.has(propertyId)) throw new Error('Property is not approved for this entity');
      if (unitId && verified.unitProperties[unitId] !== propertyId) {
        throw new Error('Unit does not belong to the selected property');
      }
      const key = propertyId + '/' + (unitId ?? '');
      if (seen.has(key)) throw new Error('Duplicate cost allocation target');
      seen.add(key);
      if (!Number.isSafeInteger(share.basisPoints) || share.basisPoints <= 0 || share.basisPoints > 10000) {
        throw new Error('Allocation shares must be positive integer basis points');
      }
      basisPoints += share.basisPoints;
      return { key, propertyId, unitId, basisPoints: share.basisPoints };
    });
    if (basisPoints !== 10000) throw new Error('Cost allocations must total exactly 100%');
    const splitNet = splitCents(netCents,scopes);
    const splitVat = splitCents(vatCents,scopes);
    const allocations = scopes.map(scope => {
      const net = splitNet.get(scope.key)!;
      const vat = splitVat.get(scope.key)!;
      return { propertyId: scope.propertyId,unitId:scope.unitId,
        basisPoints:scope.basisPoints,netCents:net,vatCents:vat,grossCents:sumCents([net,vat]) };
    });
    if (sumCents(allocations.map(x=>x.grossCents)) !== grossCents) {
      throw new Error('Allocation arithmetic mismatch');
    }
    return { category:line.category,description,netCents,vatCents,grossCents,allocations };
  });
  const netCents = sumCents(lines.map(x=>x.netCents));
  const vatCents = sumCents(lines.map(x=>x.vatCents));
  const grossCents = sumCents([netCents,vatCents]);
  return {
    legalEntityId,supplierRelationshipId,supplierInvoiceNumber,
    identityKey:purchaseExpenseIdentityKey(legalEntityId,supplierRelationshipId,supplierInvoiceNumber),
    invoiceDate,dueDate,servicePeriodStart:from,servicePeriodEnd:through,
    currency:'EUR',sourceSha256,requiresDocument:sourceSha256 === null,
    totals:{netCents,vatCents,grossCents},lines,
  };
}

/** Only a submitted/approved supplier purchase with original evidence is export-ready. */
export function canApproveSupplierExpense(expense: NormalisedExpense): boolean {
  return !expense.requiresDocument &&
    !!expense.sourceSha256 &&
    expense.totals.grossCents > 0 &&
    expense.lines.length > 0;
}
