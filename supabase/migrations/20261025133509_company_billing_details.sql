begin;
-- Add optional company master data without rewriting existing addresses or snapshots.
alter table public.mzs_lease_relationships add column company_details jsonb not null default '{}'::jsonb;
create function mzs_private.valid_company_details(d jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; t text; max_length integer;
begin
 if d is null or jsonb_typeof(d)<>'object' then return false; end if;
 for k,v in select * from jsonb_each(d) loop
  if k in ('invoice_address','correspondence_address') then
   if not mzs_private.valid_relationship_address(v) then return false; end if;
  else
   max_length:=case k when 'trading_name' then 180 when 'registration_number' then 100 when 'tax_id' then 60 when 'attention' then 180 when 'website' then 500 when 'invoice_email' then 254 when 'invoice_attention' then 180 when 'correspondence_email' then 254 when 'correspondence_attention' then 180 end;
   if max_length is null or jsonb_typeof(v)<>'string' then return false; end if;
   t:=v#>>'{}';
   if length(t)>max_length or t ~ E'[\r\n]' then return false; end if;
   if k in ('invoice_email','correspondence_email') and t<>'' and t !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$' then return false; end if;
   if k='website' and t<>'' and t !~* '^https://[^[:space:]]+$' then return false; end if;
  end if;
 end loop;
 return true;
end $$;
revoke all on function mzs_private.valid_company_details(jsonb) from public,anon,authenticated,service_role;
grant execute on function mzs_private.valid_company_details(jsonb) to authenticated;
alter table public.mzs_lease_relationships add constraint relationship_company_details_valid check(mzs_private.valid_company_details(company_details));
-- Contract copies are explicit snapshots; active-contract locking already compares all columns.
alter table public.mzs_lease_contracts
 add column tenant_tax_id text not null default '' check(length(tenant_tax_id)<=60 and tenant_tax_id !~ E'[\r\n]'),
 add column tenant_attention text not null default '' check(length(tenant_attention)<=180 and tenant_attention !~ E'[\r\n]');
commit;
