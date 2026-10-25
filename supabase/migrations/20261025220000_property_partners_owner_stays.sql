-- Property partners and owner usage: separate permissions from global client/partner role.
create table if not exists public.mzs_property_partners (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 profile_id uuid not null references public.profiles(id),
 complimentary_owner_stays boolean not null default false,
 requires_approval boolean not null default true check (requires_approval),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(project_id,profile_id)
);
create table if not exists public.mzs_owner_stay_requests (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references public.mzs_property_partners(id),
 check_in date not null,
 check_out date not null,
 guest_count integer not null default 1 check (guest_count between 1 and 30),
 notes text not null default '' check (length(notes)<=1500),
 status text not null default 'requested' check (status in ('requested','confirmed','declined')),
 booking_id uuid unique references public.rental_bookings(id),
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check(check_out>check_in)
);
create table if not exists public.mzs_booking_price_audit (
 id bigint generated always as identity primary key,
 booking_id uuid not null references public.rental_bookings(id),
 admin_id uuid not null references public.profiles(id),
 old_total numeric,
 new_total numeric not null check(new_total>=0),
 reason text not null check(length(btrim(reason))>=5),
 created_at timestamptz not null default now()
);
alter table public.mzs_property_partners enable row level security;
alter table public.mzs_owner_stay_requests enable row level security;
alter table public.mzs_booking_price_audit enable row level security;
-- No policies permit a partner to modify an approval, assign themselves to a property,
-- or change booking prices. These are server-checked administrator operations only.
create policy property_partner_admin on public.mzs_property_partners
 for all to authenticated using ((select public.is_admin()))
 with check ((select public.is_admin()));
create policy property_partner_own_read on public.mzs_property_partners
 for select to authenticated using(profile_id=(select auth.uid()) and is_active);
create policy owner_stay_admin on public.mzs_owner_stay_requests
 for all to authenticated using ((select public.is_admin()))
 with check ((select public.is_admin()));
create policy owner_stay_own_read on public.mzs_owner_stay_requests
 for select to authenticated using(exists
 (select 1 from public.mzs_property_partners p where p.id=partner_id and p.profile_id=(select auth.uid()) and p.is_active));
create policy owner_stay_self_request on public.mzs_owner_stay_requests
 for insert to authenticated with check (
 status='requested' and booking_id is null and reviewed_at is null and reviewed_by is null
 and check_in >= current_date and check_out>check_in
 and exists(select 1 from public.mzs_property_partners p
 where p.id=partner_id and p.profile_id=(select auth.uid()) and p.is_active and p.complimentary_owner_stays and p.requires_approval)
);
create policy booking_price_admin_audit on public.mzs_booking_price_audit
 for select to authenticated using ((select public.is_admin()));
grant select,insert,update,delete on public.mzs_property_partners to authenticated;
grant select,insert,update on public.mzs_owner_stay_requests to authenticated;
grant select on public.mzs_booking_price_audit to authenticated;
-- Owner-stay requests remain pending, do not block inventory, and create NO cashflow.
-- Approval and pricing will use dedicated audited administrator server routes.
