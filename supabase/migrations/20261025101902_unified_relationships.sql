begin;
-- Reuse the existing relationship IDs and links. The legacy table name is retained.
alter table public.mzs_lease_relationships drop constraint mzs_lease_relationships_roles_check;
alter table public.mzs_lease_relationships add constraint mzs_lease_relationships_roles_check
 check(roles <@ array['client','tenant','owner','investor','partner']::text[] and cardinality(roles)>0 and array_position(roles,null) is null);
alter table public.mzs_lease_relationships alter column roles set default array['client']::text[];
alter table public.mzs_lease_relationships add column email_normalized text generated always as(lower(btrim(email))) stored;
create unique index relationship_person_account_unique on public.mzs_lease_relationships(profile_id) where kind='person' and profile_id is not null;
create unique index relationship_person_email_unique on public.mzs_lease_relationships(email_normalized) where kind='person' and email_normalized<>'';

create function mzs_private.validate_relationship_account() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.profile_id is not null and not exists(select 1 from public.profiles p where p.id=new.profile_id and p.role in ('client','partner')) then
  raise exception 'Select an existing client or partner account' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function mzs_private.validate_relationship_account() from public,anon,authenticated,service_role;
create trigger validate_relationship_account before insert or update of profile_id on public.mzs_lease_relationships for each row execute function mzs_private.validate_relationship_account();

create function mzs_private.link_contract_relationship_account() returns trigger language plpgsql security invoker set search_path='' as $$
declare account_id uuid;
begin
 if new.tenant_relationship_id is not null then
  select profile_id into strict account_id from public.mzs_lease_relationships where id=new.tenant_relationship_id;
  if new.tenant_profile_id is not null and new.tenant_profile_id is distinct from account_id then
   raise exception 'Use the account linked to the central relationship' using errcode='23514';
  end if;
  new.tenant_profile_id:=account_id;
 end if;
 if new.tenant_profile_id is not null and not exists(select 1 from public.profiles where id=new.tenant_profile_id and role in ('client','partner')) then
  raise exception 'Select an existing client or partner account' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function mzs_private.link_contract_relationship_account() from public,anon,authenticated,service_role;
create trigger b_contract_relationship_account before insert or update of tenant_relationship_id,tenant_profile_id on public.mzs_lease_contracts for each row execute function mzs_private.link_contract_relationship_account();

-- Narrow, account-bound read model. Raw administration tables remain admin-only.
-- A private definer is necessary to project approved fields through the admin RLS.
create function mzs_private.member_relationship_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member_id uuid:=auth.uid(); result jsonb;
begin
 if member_id is null or not exists(select 1 from public.profiles where id=member_id and is_active=true and role in ('client','partner')) then
  raise exception 'An active client or partner account is required' using errcode='42501';
 end if;
 select jsonb_build_object(
  'companies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'address',r.address) order by r.name,r.id)
    from public.mzs_lease_relationships r where r.kind='company' and r.profile_id=member_id),'[]'::jsonb),
  'contracts',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'title',c.title,'status',c.status,'lease_start',c.lease_start,'lease_end',c.lease_end,
    'tenant_name',c.tenant_name,'issuer_name',c.issuer_name,
    'units',coalesce((select jsonb_agg(u.address order by u.address,u.id) from public.mzs_estate_units u where u.id=any(c.unit_ids)),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.number,'issued_on',i.issued_on,'due_date',i.due_date,'total',i.total,
       'outstanding',i.total-coalesce((select sum(p.amount) from public.mzs_lease_payments p where p.invoice_id=i.id and p.reversed_at is null),0)) order by i.issued_on desc,i.number)
      from public.mzs_lease_invoices i where i.contract_id=c.id),'[]'::jsonb)
   ) order by c.lease_start desc,c.id) from public.mzs_lease_contracts c where c.tenant_profile_id=member_id and c.status in ('active','stopped')),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function mzs_private.member_relationship_overview() from public,anon,authenticated,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.member_relationship_overview() to authenticated;
create function public.mzs_member_relationship_overview() returns jsonb language sql stable security invoker set search_path='' as $$select mzs_private.member_relationship_overview()$$;
revoke all on function public.mzs_member_relationship_overview() from public,anon,authenticated,service_role;
grant execute on function public.mzs_member_relationship_overview() to authenticated;
commit;
