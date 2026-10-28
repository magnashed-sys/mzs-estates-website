-- Reject stale maintenance forms instead of silently replacing newer assignments.
begin;
alter table public.mzs_ops_maintenance_events add column expected_event_id uuid;
grant insert(expected_event_id) on public.mzs_ops_maintenance_events to authenticated;
create function mzs_private.ops_validate_maintenance_freshness()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare latest uuid;
begin
 if auth.uid() is null or public.is_admin() is distinct from true or new.actor_id is distinct from auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 select id into latest from public.mzs_ops_maintenance_events where ticket_id=new.ticket_id order by sequence_no desc limit 1;
 if new.expected_event_id is distinct from latest then raise exception 'Stale maintenance form: reload current planning';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_maintenance_freshness() from public,anon,authenticated,service_role;
create trigger ops_maintenance_event_freshness before insert on public.mzs_ops_maintenance_events for each row execute function mzs_private.ops_validate_maintenance_freshness();
create or replace view public.mzs_ops_current_tickets with(security_invoker=true,security_barrier=true) as
select t.id,t.reported_by,t.property_id,t.unit_id,t.priority,t.title,t.description,t.created_at,
 coalesce(e.action,t.status) as status,e.responsible_profile_id,e.scheduled_for,e.note as latest_note,e.id as latest_event_id
from public.mzs_ops_maintenance_tickets t
left join lateral(select e.* from public.mzs_ops_maintenance_events e where e.ticket_id=t.id order by e.sequence_no desc limit 1) e on true;
commit;
