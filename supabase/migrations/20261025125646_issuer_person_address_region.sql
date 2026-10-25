-- Permit a separate region when importing a person address. No data rewrites.
create or replace function mzs_private.valid_issuer_details(d jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item record; max_length integer;
begin
 if jsonb_typeof(d)<>'object' then return false;end if;
 for item in select * from jsonb_each(d) loop
  max_length:=case item.key when 'trading_name' then 180 when 'legal_form' then 100 when 'country' then 120 when 'street' then 200 when 'house_number' then 30 when 'address_extra' then 100 when 'postal_code' then 30 when 'city' then 120 when 'region' then 120 when 'contact_name' then 180 when 'email' then 200 when 'phone' then 60 when 'website' then 500 when 'account_holder' then 200 when 'bic' then 11 when 'payment_instructions' then 1000 when 'billing_address' then 1000 when 'reply_to' then 200 when 'logo' then 280000 else -1 end;
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
