-- Complete staff time correction/review workflow for operational-area hours.
-- Same account/scope checks as normal visits; no client recharge for operational locations.
begin;
set local lock_timeout='3s';
drop policy ops_visit_correction_read on public.mzs_ops_visit_correction_requests;
create policy ops_visit_correction_read on public.mzs_ops_visit_correction_requests
 for select to authenticated using((select public.is_admin()) or
  (requested_by=(select auth.uid()) and exists(
   select 1 from public.mzs_ops_staff_visits v where v.id=visit_id and v.profile_id=(select auth.uid())
   and ((v.property_id is not null and mzs_private.ops_can_work_on_property(v.property_id))
     or (v.work_area_id is not null and mzs_private.ops_can_work_on_area(v.work_area_id))))));
drop policy ops_visit_correction_insert on public.mzs_ops_visit_correction_requests;
create policy ops_visit_correction_insert on public.mzs_ops_visit_correction_requests
 for insert to authenticated with check(requested_by=(select auth.uid()) and
  ((select public.is_admin()) or exists(
   select 1 from public.mzs_ops_staff_visits v where v.id=visit_id and v.profile_id=(select auth.uid())
   and ((v.property_id is not null and mzs_private.ops_can_work_on_property(v.property_id))
     or (v.work_area_id is not null and mzs_private.ops_can_work_on_area(v.work_area_id))))));
drop policy ops_visit_correction_decision_read on public.mzs_ops_visit_correction_decisions;
create policy ops_visit_correction_decision_read on public.mzs_ops_visit_correction_decisions
 for select to authenticated using((select public.is_admin()) or exists(
  select 1 from public.mzs_ops_visit_correction_requests c
  join public.mzs_ops_staff_visits v on v.id=c.visit_id
  where c.id=correction_id and v.profile_id=(select auth.uid())
    and ((v.property_id is not null and mzs_private.ops_can_work_on_property(v.property_id))
     or (v.work_area_id is not null and mzs_private.ops_can_work_on_area(v.work_area_id)))));

create or replace function mzs_private.ops_validate_visit_correction_request()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare original public.mzs_ops_staff_visits; effective_minutes integer;
begin
 if auth.uid() is null or new.requested_by is distinct from auth.uid() then
  raise exception 'Authenticated author required' using errcode='42501';end if;
 select * into original from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Visit missing';end if;
 if not (public.is_admin() or (original.profile_id=auth.uid()
  and ((original.property_id is not null and mzs_private.ops_can_work_on_property(original.property_id))
   or (original.work_area_id is not null and mzs_private.ops_can_work_on_area(original.work_area_id)))))
  then raise exception 'Visit access denied' using errcode='42501';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_requests c where c.visit_id=new.visit_id
  and not exists(select 1 from public.mzs_ops_visit_correction_decisions d where d.correction_id=c.id))
  then raise exception 'A pending correction already exists';end if;
 select c.proposed_minutes into effective_minutes
 from public.mzs_ops_visit_correction_requests c
 join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved'
 where c.visit_id=new.visit_id order by c.sequence_no desc limit 1;
 if new.proposed_minutes=coalesce(effective_minutes,original.actual_minutes)
  then raise exception 'Correction must change current minutes';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_correction_request() from public,anon,authenticated,service_role;

create or replace function mzs_private.ops_visible_visit_reviews()
returns table(id uuid,visit_id uuid,correction_id uuid,decision text,reason text,reviewed_minutes integer,reviewed_at timestamptz)
language sql stable security definer set search_path='' as $fn$
 select r.id,r.visit_id,r.correction_id,r.decision,r.reason,r.reviewed_minutes,r.reviewed_at
 from public.mzs_ops_visit_reviews r
 join public.mzs_ops_staff_visits v on v.id=r.visit_id
 where public.is_admin() or (v.profile_id=auth.uid() and
  ((v.property_id is not null and mzs_private.ops_can_work_on_property(v.property_id))
   or (v.work_area_id is not null and mzs_private.ops_can_work_on_area(v.work_area_id))))
$fn$;
revoke all on function mzs_private.ops_visible_visit_reviews() from public,anon,service_role;
-- Preserve the existing authenticated EXECUTE for the narrow review-status view.
grant execute on function mzs_private.ops_visible_visit_reviews() to authenticated;

create or replace function mzs_private.ops_validate_visit_review()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare visit public.mzs_ops_staff_visits; revision uuid; effective_minutes integer;
begin
 if auth.uid() is null or public.is_admin() is distinct from true
  or new.reviewed_by is distinct from auth.uid() then
  raise exception 'Admin required' using errcode='42501';end if;
 select * into visit from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Visit missing';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_requests c where c.visit_id=visit.id
  and not exists(select 1 from public.mzs_ops_visit_correction_decisions d where d.correction_id=c.id))
  then raise exception 'Pending correction must be decided first';end if;
 select c.id,c.proposed_minutes into revision,effective_minutes
 from public.mzs_ops_visit_correction_requests c
 join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved'
 where c.visit_id=visit.id order by c.sequence_no desc limit 1;
 if new.correction_id is distinct from revision then
  raise exception 'Stale review: reload current revision';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews r where r.visit_id=visit.id
  and r.correction_id is not distinct from revision) then
  raise exception 'Revision already reviewed';end if;
 new.reviewed_minutes:=coalesce(effective_minutes,visit.actual_minutes);
 if visit.work_area_id is not null and
  (new.recharge_class is distinct from 'not_billable'
   or new.minimum_minutes is not null or new.increment_minutes is not null) then
  raise exception 'Operational location is internal-only time, not a recharge' using errcode='22023';end if;
 if new.decision='approved' and new.recharge_class='review_candidate' then
  if new.minimum_minutes is null or new.increment_minutes is null or new.minimum_minutes<0 or
   new.minimum_minutes>960 or new.increment_minutes<1 or new.increment_minutes>960 then
   raise exception 'Explicit billing rule required';end if;
  new.billable_minutes:=greatest(new.minimum_minutes,((new.reviewed_minutes+new.increment_minutes-1)/new.increment_minutes)*new.increment_minutes);
 else
  if new.minimum_minutes is not null or new.increment_minutes is not null then
   raise exception 'No billing rule for rejected or internal time';end if;
  new.billable_minutes:=0;
 end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_review() from public,anon,authenticated,service_role;
commit;
