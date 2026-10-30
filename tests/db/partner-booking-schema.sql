create table public.projects(id uuid primary key,slug text,title text,subtitle text,location text,status text,hero_image_url text,created_at timestamptz,updated_at timestamptz);
alter table public.projects enable row level security;
grant select on public.projects to authenticated;
create policy admin_read on public.projects for select to authenticated using(public.is_admin());
create table public.rental_bookings(id uuid primary key,project_id uuid,user_id uuid,check_in date,check_out date,guest_count integer,preferred_check_in text,preferred_check_out text,pool_heating_requested boolean,status text,quoted_nightly_rate_eur numeric,quoted_total_eur numeric,guest_notes text,admin_notes text,created_at timestamptz,reviewed_at timestamptz,reviewed_by uuid,is_test boolean,rental_configuration_id uuid);
alter table public.rental_bookings enable row level security;
grant select on public.rental_bookings to authenticated;
create policy admin_read on public.rental_bookings for select to authenticated using(public.is_admin());
