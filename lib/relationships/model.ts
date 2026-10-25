export const relationshipRoles = ['client', 'tenant', 'owner', 'investor', 'partner'] as const;
export const addressFields = {
  street: ['Street', 200, 'address-line1'], house_number: ['House number', 30, 'off'],
  addition: ['Address addition', 100, 'address-line2'], postal_code: ['Postal code', 30, 'postal-code'],
  city: ['City', 120, 'address-level2'], region: ['Region / province', 120, 'address-level1'],
  country: ['Country', 120, 'country-name'],
} as const;
export type BillingAddress = Partial<Record<keyof typeof addressFields, string>>;
export const companyFields = {
  trading_name: ['Trading name', 180], registration_number: ['Registration number / KvK', 100],
  tax_id: ['VAT / tax number', 60], attention: ['Contact person / attention (t.a.v.)', 180],
  website: ['Website (https://)', 500], invoice_email: ['Invoice email', 254],
  invoice_attention: ['Invoice attention (t.a.v.)', 180], correspondence_email: ['Correspondence email', 254],
  correspondence_attention: ['Correspondence attention (t.a.v.)', 180],
} as const;
export type CompanyDetails = Partial<Record<keyof typeof companyFields, string>> & {
  invoice_address?: BillingAddress; correspondence_address?: BillingAddress;
};
export function normalizeAddress(raw: unknown): BillingAddress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k=>!Object.hasOwn(addressFields,k))) throw new Error('Check the separate address fields.');
  const address: BillingAddress = {};
  for (const [key,[,limit]] of Object.entries(addressFields)) {
    const value = (raw as Record<string,unknown>)[key] ?? '';
    if(typeof value !== 'string' || value.trim().length>limit || /[\r\n]/.test(value)) throw new Error('Check the address field values and lengths.');
    if(value.trim()) address[key as keyof BillingAddress]=value.trim();
  }
  return address;
}
export function normalizeCompanyDetails(raw: unknown): CompanyDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k=>!Object.hasOwn(companyFields,k)&&!['invoice_address','correspondence_address'].includes(k))) throw new Error('Check the company details.');
  const input=raw as Record<string,unknown>, result: CompanyDetails={};
  for(const [key,[label,max]] of Object.entries(companyFields)) {
    const value=input[key] ?? '';
    if(typeof value!=='string'||value.trim().length>max||/[\r\n]/.test(value))throw new Error(`Check ${label.toLowerCase()}.`);
    const clean=value.trim();
    if(key.endsWith('_email')&&clean&&!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(clean))throw new Error(`Enter one valid ${label.toLowerCase()}.`);
    if(key==='website'&&clean&&!/^https:\/\/[^\s]+$/i.test(clean))throw new Error('Website must start with https://.');
    if(clean)result[key as keyof typeof companyFields]=clean;
  }
  for(const key of ['invoice_address','correspondence_address'] as const)if(input[key]!==undefined){const a=normalizeAddress(input[key]);if(Object.keys(a).length)result[key]=a;}
  return result;
}
export function formatBillingAddress(a: BillingAddress) {
  return [[a.street,a.house_number].filter(Boolean).join(' '),a.addition,[a.postal_code,a.city].filter(Boolean).join(' '),a.region,a.country].filter(Boolean).join('\n');
}
export type RelationshipRecord = {
  id: string; version: number; name: string; kind: string; address: string;
  email: string; phone: string; reference: string; roles?: string[]; profile_id?: string | null;
  billing_address?: BillingAddress;
  company_details?: CompanyDetails;
};
// An alternative address is one complete block, never combined with the main address.
export function relationshipDelivery(record: RelationshipRecord, purpose: 'invoice' | 'correspondence' = 'invoice') {
  const d=record.kind==='company'?record.company_details || {}:{};
  const alternative=d[`${purpose}_address`];
  const address=alternative&&formatBillingAddress(alternative);
  return {address:address || record.address, email:d[`${purpose}_email`] || record.email, attention:d[`${purpose}_attention`] || d.attention || ''};
}
export type RelationshipMember = {id: string; full_name: string | null; email: string; role?: string; is_active?: boolean};
export const normalizedEmail = (value: string) => value.trim().toLowerCase();

export function normalizeRelationship(input: Record<string, unknown>) {
  const limits = {name: 200, address: 1000, email: 254, phone: 100, reference: 200};
  const fields = {} as Record<keyof typeof limits, string>;
  for (const [key, limit] of Object.entries(limits)) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.trim().length > limit) throw new Error('Check the field values and maximum lengths.');
    fields[key as keyof typeof limits] = value.trim();
  }
  if (fields.name.length < 2) throw new Error('Enter a name of at least two characters.');
  if (!['person', 'company'].includes(String(input.kind))) throw new Error('Select a person or company.');
  if (fields.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(fields.email)) throw new Error('Enter one valid email address.');
  if (!Array.isArray(input.roles) || !input.roles.length || input.roles.some(r => !relationshipRoles.includes(r))) throw new Error('Select at least one relationship role.');
  const profile = input.profile_id === undefined || input.profile_id === '' ? null : input.profile_id;
  if (profile !== null && (typeof profile !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(profile))) throw new Error('Select an existing client or partner account.');
  let billing_address: BillingAddress | undefined;
  if (input.billing_address !== undefined) {
    billing_address = normalizeAddress(input.billing_address);
    fields.address = formatBillingAddress(billing_address);
  }
  return {...fields, ...(input.company_details===undefined?{}:{company_details:normalizeCompanyDetails(input.company_details)}), ...(billing_address === undefined ? {} : {billing_address}), kind: input.kind as 'person' | 'company', roles: [...new Set(input.roles)] as string[], profile_id: profile as string | null};
}

// An account and its administrative extension appear as one person in the register.
export function unextendedMembers(records: RelationshipRecord[], members: RelationshipMember[]) {
  const linked = new Set(records.filter(r => r.kind === 'person' && r.profile_id).map(r => r.profile_id));
  return members.filter(member => !linked.has(member.id));
}
