-- Add optional task identifier to existing staff visit/read model, without changing its prior columns.
begin;
set local lock_timeout='2s';
create or replace view public.mzs_ops_current_visits
 with(security_invoker=true,security_barrier=true) as
 select v.id,v.profile_id,v.property_id,v.unit_id,v.worked_on,v.actual_minutes,v.task_category,
 v.description,v.created_at,
 c.id as correction_id,coalesce(c.proposed_minutes,v.actual_minutes) as effective_minutes,
 r.decision as review_decision,r.reason as review_reason,r.reviewed_at,
 exists(select 1 from public.mzs_ops_visit_correction_requests pc
 where pc.visit_id=v.id and not exists(select 1 from public.mzs_ops_visit_correction_decisions pd
 where pd.correction_id=pc.id)) as correction_pending,
 v.task_id
 from public.mzs_ops_staff_visits v
 left join lateral(
  select c.id,c.proposed_minutes from public.mzs_ops_visit_correction_requests c
  join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved'
  where c.visit_id=v.id order by c.sequence_no desc limit 1
 ) c on true
 left join public.mzs_ops_staff_review_status r
 on r.visit_id=v.id and r.correction_id is not distinct from c.id;
revoke all on public.mzs_ops_current_visits from public,anon,authenticated,service_role;
grant select on public.mzs_ops_current_visits to authenticated;
comment on view public.mzs_ops_current_visits is 'Staff actual-time register with optional task link; never auto-invoiced or posted.';
commit;