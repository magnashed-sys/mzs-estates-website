-- Owner-authorized archival closure of Catherine's pre-2026-W44 weekly source reports.
-- Historical amounts/estimated client billing hours are deliberately NOT staff time records.
-- Do not backfill mzs_ops_staff_visits, change receipts, or rebill Zorgbalans 7113.
begin;
set local lock_timeout='3s';

create table public.mzs_ops_staff_legacy_history (
 id uuid primary key references public.mzs_ops_historical_cost_rows(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 reporting_year integer not null,
 iso_week integer not null check (iso_week between 1 and 53),
 period_from date not null,
 period_until date not null,
 original_location text not null,
 category text not null,
 description text not null,
 source_reference text,
 close_status text not null default 'historical_closed' check (close_status='historical_closed'),
 closed_at timestamptz not null default now(),
 closure_note text not null default 'Closed historical weekly source record; actual worked minutes were not captured.',
 check (period_from <= period_until and period_until < date '2026-10-26')
);
create index ops_staff_legacy_profile_week
 on public.mzs_ops_staff_legacy_history(profile_id,reporting_year desc,iso_week desc,id);
alter table public.mzs_ops_staff_legacy_history enable row level security;
revoke all on public.mzs_ops_staff_legacy_history from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_legacy_history to authenticated;
create policy ops_staff_legacy_read on public.mzs_ops_staff_legacy_history
 for select to authenticated using (
  ((select auth.uid())=profile_id
   and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active))
  or (select public.is_admin())
 );

-- Only previously imported original rows: no constructed date, minute or hourly rate.
-- Future/current-week submissions are handled solely by the live staff time workflow.
insert into public.mzs_ops_staff_legacy_history(
 id,profile_id,reporting_year,iso_week,period_from,period_until,
 original_location,category,description,source_reference
)
select h.id,h.profile_id,h.reporting_year,h.iso_week,h.period_from,h.period_until,
 h.original_location,h.category,h.description,h.source_reference
from public.mzs_ops_historical_cost_rows h
join public.profiles p on p.id=h.profile_id
where lower(p.email)='ledders2@hotmail.com' and p.is_active
 and h.reporting_year=2026 and h.period_until<date '2026-10-26'
on conflict (id) do nothing;

commit;
