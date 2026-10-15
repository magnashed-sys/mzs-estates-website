-- MZS Group | Private member profile & declared company relationships V1
-- REVIEW: STAGING FIRST. Do NOT apply to Production as part of creation.
-- Additive only: existing profiles, auth users, project access and invites stay intact.
begin;

create table if not exists public.mzs_member_contact_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  street_address text,
  house_number text,
  address_addition text,
  postal_code text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mzs_contact_phone_length check (phone is null or length(phone)<=40),
  constraint mzs_contact_street_length check (street_address is null or length(street_address)<=160),
  constraint mzs_contact_house_no_length check (house_number is null or length(house_number)<=24),
  constraint mzs_contact_addition_length check (address_addition is null or length(address_addition)<=80),
  constraint mzs_contact_postal_length check (postal_code is null or length(postal_code)<=24),
  constraint mzs_contact_city_length check (city is null or length(city)<=120),
  constraint mzs_contact_region_length check (region is null or length(region)<=120),
  constraint mzs_contact_country_length check (country is null or length(country)<=120)
);
alter table public.mzs_member_contact_details enable row level security;
revoke all on public.mzs_member_contact_details from anon, authenticated;
grant select on public.mzs_member_contact_details to authenticated;
-- Personal updates use a verified RPC rather than direct client UPDATE.
create policy mzs_member_contact_read on public.mzs_member_contact_details
  for select to authenticated using (
    user_id=(select auth.uid()) or (select public.is_admin())
  );

create table if not exists public.mzs_member_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  legal_name text not null,
  trading_name text,
  registration_number text,
  country text,
  relationship_type text not null,
  relationship_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mzs_company_legal_name_length check (length(btrim(legal_name)) between 2 and 180),
  constraint mzs_company_trading_name_length check (trading_name is null or length(trading_name)<=180),
  constraint mzs_company_registration_length check (registration_number is null or length(registration_number)<=100),
  constraint mzs_company_country_length check (country is null or length(country)<=120),
  constraint mzs_company_notes_length check (relationship_notes is null or length(relationship_notes)<=1000),
  constraint mzs_company_relationship_enum check (relationship_type in (
    'owner','co_owner','shareholder','director','employee','authorized_representative','advisor','other'
  ))
);
create index if not exists mzs_member_companies_user_idx
  on public.mzs_member_companies(user_id,created_at desc);
-- Per-member company entries are independent declarations, not a
-- public business registry or administrator-verified ownership record.
alter table public.mzs_member_companies enable row level security;
revoke all on public.mzs_member_companies from anon, authenticated;
grant select,insert,update,delete on public.mzs_member_companies to authenticated;

create policy mzs_member_company_read on public.mzs_member_companies
  for select to authenticated using (
    (user_id=(select auth.uid()) and (select public.is_active_member()))
    or (select public.is_admin())
  );
create policy mzs_member_company_insert on public.mzs_member_companies
  for insert to authenticated with check (
    user_id=(select auth.uid()) and (select public.is_active_member())
  );
create policy mzs_member_company_update on public.mzs_member_companies
  for update to authenticated using (
    user_id=(select auth.uid()) and (select public.is_active_member())
  ) with check (
    user_id=(select auth.uid()) and (select public.is_active_member())
  );
create policy mzs_member_company_delete on public.mzs_member_companies
  for delete to authenticated using (
    user_id=(select auth.uid()) and (select public.is_active_member())
  );

create or replace function public.mzs_set_member_contact(
  p_full_name text,
  p_phone text,
  p_street_address text,
  p_house_number text,
  p_address_addition text,
  p_postal_code text,
  p_city text,
  p_region text,
  p_country text
) returns boolean
language plpgsql security definer set search_path=''
as $mzs$
declare
  v_user uuid := (select auth.uid());
  v_name text := regexp_replace(btrim(coalesce(p_full_name,'')),'[[:space:]]+',' ','g');
begin
  if v_user is null or not exists (
    select 1 from public.profiles
    where id=v_user and is_active=true and role in ('client','partner')
  ) then
    raise exception 'An active client or partner account is required' using errcode='42501';
  end if;
  if length(v_name) not between 3 and 120
     or length(coalesce(p_phone,''))>40
     or length(coalesce(p_street_address,''))>160
     or length(coalesce(p_house_number,''))>24
     or length(coalesce(p_address_addition,''))>80
     or length(coalesce(p_postal_code,''))>24
     or length(coalesce(p_city,''))>120
     or length(coalesce(p_region,''))>120
     or length(coalesce(p_country,''))>120
  then
    raise exception 'Invalid profile values or field lengths' using errcode='22023';
  end if;
  update public.profiles
    set full_name=v_name, updated_at=now()
    where id=v_user and is_active=true and role in ('client','partner');
  if not found then
    raise exception 'Member profile unavailable' using errcode='42501';
  end if;

  insert into public.mzs_member_contact_details (
    user_id,phone,street_address,house_number,address_addition,
    postal_code,city,region,country
  ) values (
    v_user,nullif(btrim(p_phone),''),
    nullif(btrim(p_street_address),''),nullif(btrim(p_house_number),''),
    nullif(btrim(p_address_addition),''),nullif(btrim(p_postal_code),''),
    nullif(btrim(p_city),''),nullif(btrim(p_region),''),
    nullif(btrim(p_country),'')
  )
  on conflict(user_id) do update set
    phone=excluded.phone,
    street_address=excluded.street_address,
    house_number=excluded.house_number,
    address_addition=excluded.address_addition,
    postal_code=excluded.postal_code,
    city=excluded.city,
    region=excluded.region,
    country=excluded.country,
    updated_at=now();
  return true;
end $mzs$;
revoke all on function public.mzs_set_member_contact(
  text,text,text,text,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.mzs_set_member_contact(
  text,text,text,text,text,text,text,text,text
) to authenticated;

-- Keep profiles.email in sync ONLY after Supabase Auth changes the
-- confirmed canonical email, never from an editable browser text field.
-- This preserves existing unique email_normalized constraints and roles.
create or replace function public.mzs_sync_verified_auth_email()
returns trigger language plpgsql security definer set search_path=''
as $mzs$
begin
  if new.email is distinct from old.email then
    if new.email is null or btrim(new.email)='' then
      raise exception 'Account email may not be empty' using errcode='23514';
    end if;
    update public.profiles
      set email=new.email, updated_at=now()
      where id=new.id;
  end if;
  return new;
end $mzs$;
revoke all on function public.mzs_sync_verified_auth_email()
  from public,anon,authenticated;
drop trigger if exists mzs_profiles_auth_email_sync on auth.users;
create trigger mzs_profiles_auth_email_sync
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.mzs_sync_verified_auth_email();

commit;
