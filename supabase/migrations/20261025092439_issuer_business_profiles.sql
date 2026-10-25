-- Additive issuer profiles; no backfill or rewrites of historical documents.
create function mzs_private.valid_issuer_details(d jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item record; max_length integer;
begin
 if jsonb_typeof(d)<>'object' then return false;end if;
 for item in select * from jsonb_each(d) loop
  max_length:=case item.key when 'trading_name' then 180 when 'legal_form' then 100 when 'country' then 120 when 'street' then 200 when 'house_number' then 30 when 'address_extra' then 100 when 'postal_code' then 30 when 'city' then 120 when 'contact_name' then 180 when 'email' then 200 when 'phone' then 60 when 'website' then 500 when 'account_holder' then 200 when 'bic' then 11 when 'payment_instructions' then 1000 when 'billing_address' then 1000 when 'reply_to' then 200 when 'logo' then 280000 else -1 end;
  if max_length<0 or jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>max_length then return false;end if;
 end loop;
 if coalesce(d->>'email','')<>'' and (d->>'email')!~'^[^@[:space:]<>;,]+@[^@[:space:]<>;,]+[.][^@[:space:]<>;,]+$' then return false;end if;
 if coalesce(d->>'reply_to','')<>'' and (d->>'reply_to')!~'^[^@[:space:]<>;,]+@[^@[:space:]<>;,]+[.][^@[:space:]<>;,]+$' then return false;end if;
 if coalesce(d->>'website','')<>'' and (d->>'website')!~'^https://[^[:space:]]+$' then return false;end if;
 if coalesce(d->>'bic','')<>'' and (d->>'bic')!~'^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' then return false;end if;
 if coalesce(d->>'logo','')<>'' and (d->>'logo')!~'^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$' then return false;end if;
 return true;
end $$;
revoke all on function mzs_private.valid_issuer_details(jsonb) from public,anon;
grant execute on function mzs_private.valid_issuer_details(jsonb) to authenticated,service_role;
alter table public.mzs_lease_issuers
 add column kind text not null default 'company' check(kind in ('company','person')),
 add column source_company_id uuid references public.mzs_member_companies(id) on delete set null,
 add column details jsonb not null default '{}'::jsonb check(mzs_private.valid_issuer_details(details));
create index lease_issuer_company on public.mzs_lease_issuers(source_company_id);
grant insert(kind,source_company_id,details),update(kind,source_company_id,details) on public.mzs_lease_issuers to authenticated;
-- Existing admin-only RLS and optimistic version trigger continue to apply.
alter table public.mzs_lease_contracts add column issuer_details jsonb not null default '{}'::jsonb;
-- The trigger overwrites draft details from the selected issuer; the existing guard locks active terms.
create or replace function mzs_private.link_lease_issuer() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.mzs_lease_issuers;
begin
 if new.status='draft' and new.issuer_id is not null then
  select * into strict e from public.mzs_lease_issuers where id=new.issuer_id;
  new.issuer_name:=e.name;new.issuer_address:=e.address;new.issuer_iban:=e.iban;new.issuer_tax_id:=e.tax_id;new.issuer_registration:=e.registration_number;
  new.issuer_details:=e.details;
 elsif new.status='draft' and new.issuer_id is null then
  new.issuer_details:='{}'::jsonb;
 end if;return new;
end $$;
-- The recurring generator already copies the entire saved contract with to_jsonb(c).
-- Issuing continues to use the reviewed draft; never consult mutable master details.
