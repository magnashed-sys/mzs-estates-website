-- Time Reporting 2.0: complete real-property + nonproperty work-area snapshot.
-- Does not change the existing v1 RPC; its archived API/tests remain compatible.
-- Exposes only an admin-authenticated, security-invoker, bounded and minimal data shape.
begin;
set local lock_timeout='3s';
create function public.mzs_ops_staff_time_report_v2(
 p_from date, p_until date, p_property uuid default null,
 p_profile uuid default null, p_area text default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare records jsonb; properties jsonb; people jsonb; work_areas jsonb; units jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Active administrator required' using errcode='42501';
 end if;
 if p_from is null or p_until is null or p_from<date '2000-01-01' or
   p_until>date '2099-12-31' or p_until<p_from or p_until-p_from>365 then
  raise exception 'Choose an inclusive period of at most 366 days' using errcode='22023';
 end if;
 if p_property is not null and p_area is not null then
  raise exception 'Choose a property OR an operational area' using errcode='22023';end if;
 if p_property is not null and not exists(
   select 1 from public.mzs_estate_properties where id=p_property
  ) then raise exception 'Unknown property' using errcode='22023';end if;
 if p_area is not null and not exists(
   select 1 from public.mzs_ops_staff_work_areas where id=p_area
  ) then raise exception 'Unknown work area' using errcode='22023';end if;
 if p_profile is not null and not exists(
   select 1 from public.profiles where id=p_profile
  ) then raise exception 'Unknown worker' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.worked_on,x.id),'[]'::jsonb)
  into records from(
   select id,property_id,work_area_id,unit_id,task_id,profile_id,
    worked_on,actual_minutes,effective_minutes,task_category,description,
    correction_id,review_decision,reviewed_at,correction_pending
   from public.mzs_ops_current_visits
   where worked_on between p_from and p_until
    and (p_property is null or property_id=p_property)
    and (p_area is null or work_area_id=p_area)
    and (p_profile is null or profile_id=p_profile)
   order by worked_on,id limit 10001
  ) x;
 if jsonb_array_length(records)>10000 then
  raise exception 'Too many visits; narrow the report filters' using errcode='54000';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
  into properties from(select id,name from public.mzs_estate_properties
   order by id limit 10001) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
  into work_areas from(select id,name from public.mzs_ops_staff_work_areas
   order by id limit 10001) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
  into units from(select id,property_id,address from public.mzs_estate_units
   order by id limit 10001) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)
  into people from(select id,full_name from public.profiles
   order by id limit 10001) x;
 if jsonb_array_length(properties)>10000 or jsonb_array_length(people)>10000 or
  jsonb_array_length(work_areas)>10000 or jsonb_array_length(units)>10000 then
   raise exception 'Directory too large' using errcode='54000';end if;
 return jsonb_build_object(
  'schema_version',2,'from',p_from,'until',p_until,'property',p_property,
  'profile',p_profile,'area',p_area,'generated_at',statement_timestamp(),
  'record_count',jsonb_array_length(records),'visits',records,
  'properties',properties,'areas',work_areas,'units',units,'people',people);
end $fn$;
revoke all on function public.mzs_ops_staff_time_report_v2(date,date,uuid,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_staff_time_report_v2(date,date,uuid,uuid,text)
 to authenticated;
comment on function public.mzs_ops_staff_time_report_v2(date,date,uuid,uuid,text) is
 'Admin-only bounded actual time snapshot including separately scoped work areas and unit labels; no payroll or invoices.';
commit;
