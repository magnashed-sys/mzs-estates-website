-- Internal weekly report: read-only source access for the backend worker only.
create table public.mzs_weekly_hours_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 recipient_user_id uuid references public.profiles(id),
 first_week date check(extract(isodow from first_week)=1)
);
insert into public.mzs_weekly_hours_settings(singleton) values(true);
create table public.mzs_weekly_hours_reports (
 week_start date primary key check(extract(isodow from week_start)=1),
 recipient_user_id uuid not null references public.profiles(id),
 status text not null check(status in ('sending','accepted','failed','uncertain','sent_via_gmail')),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 error_category text
);
alter table public.mzs_weekly_hours_settings enable row level security;
alter table public.mzs_weekly_hours_reports enable row level security;
revoke all on public.mzs_weekly_hours_settings,public.mzs_weekly_hours_reports from public,anon,authenticated;
grant select,insert,update on public.mzs_weekly_hours_settings,public.mzs_weekly_hours_reports to service_role;
-- No new authenticated/anonymous access and no permission to mutate operational data.
grant select(id,profile_id,property_id,unit_id,worked_on,actual_minutes,description,created_at,work_area_id) on public.mzs_ops_staff_visits to service_role;
grant select(id,visit_id,proposed_minutes,sequence_no) on public.mzs_ops_visit_correction_requests to service_role;
grant select(correction_id,decision) on public.mzs_ops_visit_correction_decisions to service_role;
grant select(visit_id,correction_id,decision) on public.mzs_ops_visit_reviews to service_role;
grant select(id,name) on public.mzs_ops_staff_work_areas to service_role;
grant select(id,name) on public.mzs_estate_properties to service_role;
grant select(id,address) on public.mzs_estate_units to service_role;
grant select(id,full_name,email) on public.profiles to service_role;

-- Single statement snapshot; JSON scalar avoids REST row truncation. No definer privileges.
create function public.mzs_weekly_hours_summary(p_week date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_week is null or extract(isodow from p_week)<>1 then raise exception 'Monday required'; end if;
 if (select count(*) from public.mzs_ops_staff_visits v
     where v.created_at >= p_week::timestamp at time zone 'Europe/Madrid'
       and v.created_at < (p_week+7)::timestamp at time zone 'Europe/Madrid')>10000
 then raise exception 'Report exceeds safe size; manual review required'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.profile_id,x.worked_on,x.id),'[]'::jsonb) into result
 from (
 select v.id,v.profile_id,coalesce(nullif(p.full_name,''),p.email,v.profile_id::text) as name,
 coalesce(a.name,e.name,'Onbekende locatie') as location,u.address as unit,
 v.worked_on,v.created_at,v.actual_minutes,coalesce(c.proposed_minutes,v.actual_minutes) as effective_minutes,
 v.description,r.decision as review_decision,
 exists(select 1 from public.mzs_ops_visit_correction_requests pc where pc.visit_id=v.id
   and not exists(select 1 from public.mzs_ops_visit_correction_decisions pd where pd.correction_id=pc.id)) as correction_pending
 from public.mzs_ops_staff_visits v
 left join public.profiles p on p.id=v.profile_id
 left join public.mzs_estate_properties e on e.id=v.property_id
 left join public.mzs_estate_units u on u.id=v.unit_id
 left join public.mzs_ops_staff_work_areas a on a.id=v.work_area_id
 left join lateral (
   select cr.id,cr.proposed_minutes from public.mzs_ops_visit_correction_requests cr
   join public.mzs_ops_visit_correction_decisions cd on cd.correction_id=cr.id and cd.decision='approved'
   where cr.visit_id=v.id order by cr.sequence_no desc limit 1
 ) c on true
 left join public.mzs_ops_visit_reviews r on r.visit_id=v.id and r.correction_id is not distinct from c.id
 where v.created_at >= p_week::timestamp at time zone 'Europe/Madrid'
 and v.created_at < (p_week+7)::timestamp at time zone 'Europe/Madrid'
 ) x;
 return result;
end $$;
revoke all on function public.mzs_weekly_hours_summary(date) from public,anon,authenticated;
grant execute on function public.mzs_weekly_hours_summary(date) to service_role;
