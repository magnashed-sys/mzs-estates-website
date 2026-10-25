export const relationshipRoles = ['client', 'tenant', 'owner', 'investor', 'partner'] as const;
export type RelationshipRecord = {
  id: string; version: number; name: string; kind: string; address: string;
  email: string; phone: string; reference: string; roles?: string[]; profile_id?: string | null;
};
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
  return {...fields, kind: input.kind as 'person' | 'company', roles: [...new Set(input.roles)] as string[], profile_id: profile as string | null};
}

// An account and its administrative extension appear as one person in the register.
export function unextendedMembers(records: RelationshipRecord[], members: RelationshipMember[]) {
  const linked = new Set(records.filter(r => r.kind === 'person' && r.profile_id).map(r => r.profile_id));
  return members.filter(member => !linked.has(member.id));
}
