export const issuerFields = {
 trading_name: ['Trading name', 180], legal_form: ['Legal form', 100], country: ['Country of establishment', 120],
 street: ['Street', 200], house_number: ['House number', 30], address_extra: ['Address addition', 100], postal_code: ['Postal code', 30], city: ['City', 120], region: ['Region / province', 120],
 contact_name: ['Contact person', 180], email: ['Contact email', 200], phone: ['Telephone', 60], website: ['Website (https://)', 500],
 account_holder: ['Account holder', 200], bic: ['BIC / SWIFT', 11], payment_instructions: ['Default payment instructions', 1000],
 billing_address: ['Different billing address (optional)', 1000], reply_to: ['Invoice reply-to email (optional)', 200],
} as const;
export type IssuerDetails = Partial<Record<keyof typeof issuerFields | 'logo', string>>;
export type CompanySource = {id:string;legal_name:string;trading_name:string|null;registration_number:string|null;country:string|null;user_id:string};
export function normalizeInvoicePrefix(value:unknown) {
 const prefix=typeof value==='string'?value.trim().toUpperCase():'';
 if(!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(prefix))throw new Error('Enter a 2–20 character invoice prefix using letters, numbers or hyphens, starting with a letter or number. For example: MN or MN-2026.');
 return prefix;
}
export function issuerSaveError(error:{code?:string;message:string}) {
 if(error.code==='23505'&&error.message.includes('mzs_lease_issuers_prefix_key'))return 'This invoice prefix is already in use. Choose a different prefix.';
 if(error.message.includes('mzs_lease_issuers_prefix_check'))return 'Enter a 2–20 character invoice prefix using letters, numbers or hyphens, starting with a letter or number.';
 return error.message;
}
export function normalizeIssuer(input:Record<string,unknown>) {
 const text=(key:string,max:number)=>{const v=input[key]??'';if(typeof v!=='string'||v.trim().length>max)throw new Error(`Invalid ${key.replaceAll('_',' ')}.`);return v.trim();};
 const kind=text('kind',20)||'company';if(!['company','person'].includes(kind))throw new Error('Select a company or private landlord.');
 const details:IssuerDetails={};for(const [key,[,max]] of Object.entries(issuerFields))details[key as keyof IssuerDetails]=text(key,max);
 for(const key of ['email','reply_to'] as const)if(details[key]&&!/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(details[key]!))throw new Error('Enter one valid email address per field.');
 if(details.website&&!/^https:\/\/[^\s]+$/i.test(details.website))throw new Error('Website must start with https://.');
 details.bic=details.bic?.toUpperCase();if(details.bic&&!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(details.bic))throw new Error('Enter a valid 8 or 11 character BIC.');
 const logo=text('logo',280000);if(logo&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo))throw new Error('Upload a PNG or JPEG logo.');details.logo=logo;
 const name=text('name',200),iban=text('iban',40).replace(/\s/g,'').toUpperCase();
 const structured=[details.street,details.house_number,details.postal_code,details.city].some(Boolean);
 if(structured&&(!details.street||!details.city||!details.country))throw new Error('Complete street, city and country, or use the existing address.');
 const address=structured?[[details.street,details.house_number,details.address_extra].filter(Boolean).join(' '),[details.postal_code,details.city].filter(Boolean).join(' '),details.region,details.country].filter(Boolean).join('\n'):text('address',1000);
 if(name.length<2||address.length<2||iban.length<5)throw new Error('Complete the legal name, address and IBAN.');
 return {name,address,iban,tax_id:text('tax_id',60),registration_number:text('registration_number',100),kind,details};
}
