import type {RelationshipRecord} from '../relationships/model';

export type PersonProfile = {id:string; full_name:string|null; email:string|null};
export type PersonRelationship = Pick<RelationshipRecord,'id'|'name'|'kind'|'address'|'email'|'phone'|'profile_id'|'billing_address'>;
export type PersonContact = Partial<Record<'phone'|'street_address'|'house_number'|'address_addition'|'postal_code'|'city'|'region'|'country',string|null>>;

// Treat an address as one unit: never combine two people's or two sources' addresses.
export function personIssuerFields(person:PersonRelationship|null, profile:PersonProfile|null, contact:PersonContact|null) {
 const billing=person?.billing_address;
 const structured=!!billing && Object.values(billing).some(v=>!!v?.trim());
 const legacy=!structured && !!person?.address?.trim();
 const a=structured ? {
  street:billing.street, house_number:billing.house_number, address_extra:billing.addition,
  postal_code:billing.postal_code, city:billing.city, region:billing.region, country:billing.country,
 } : legacy ? {} : {
  street:contact?.street_address, house_number:contact?.house_number, address_extra:contact?.address_addition,
  postal_code:contact?.postal_code, city:contact?.city, region:contact?.region, country:contact?.country,
 };
 const name=person?.name?.trim() || profile?.full_name?.trim() || '';
 return {
  kind:'person', relationship_id:person?.id || '', source_company_id:'', name, contact_name:name,
  email:person?.email?.trim() || profile?.email?.trim() || '', phone:person?.phone?.trim() || contact?.phone?.trim() || '',
  address:legacy ? person!.address : '',
  street:a.street || '', house_number:a.house_number || '', address_extra:a.address_extra || '',
  postal_code:a.postal_code || '', city:a.city || '', region:a.region || '', country:a.country || '',
 };
}
