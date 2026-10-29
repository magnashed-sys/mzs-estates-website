-- Queue one administrator inbox notification for each task created by scoped property staff.
-- Admin-created tasks are excluded; no notification is sent from database triggers.
begin;
set local lock_timeout='2s';

alter table public.mzs_mail_outbox
  drop constraint if exists mzs_mail_outbox_event_type_check;
alter table public.mzs_mail_outbox
  add constraint mzs_mail_outbox_event_type_check check (
    event_type in (
      'application_received','account_activated','new_project_access',
      'capital_access_granted','intro_call_requested','owner_stay_requested',
      'property_staff_task_created'
    )
  );

create function mzs_private.queue_property_staff_task_notice()
returns trigger language plpgsql security definer set search_path='' as $function$
begin
  -- Staff can only create tasks assigned to themselves within their own scope.
  -- Never send mail for tasks entered by Group Admin.
  if new.created_by is distinct from new.assigned_profile_id
     or not exists (
       select 1 from public.profiles p
       where p.id = new.created_by and p.is_active and p.role::text in ('client','partner')
     )
     or not mzs_private.ops_can_work_on_property_as(new.created_by,new.property_id)
  then return new; end if;

  insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
    select recipient.id, 'property_staff_task_created',
      jsonb_build_object('task_id',new.id),
      'property-staff-task:' || new.id::text || ':' || recipient.id::text
    from public.profiles recipient
    where lower(recipient.email) = 'magdy@mzsgroup.eu' and recipient.is_active
    on conflict (idempotency_key) do nothing;
  return new;
end $function$;

revoke all on function mzs_private.queue_property_staff_task_notice() from public,anon,authenticated,service_role;
create trigger ops_property_staff_task_email
after insert on public.mzs_ops_property_tasks
for each row execute function mzs_private.queue_property_staff_task_notice();
commit;
