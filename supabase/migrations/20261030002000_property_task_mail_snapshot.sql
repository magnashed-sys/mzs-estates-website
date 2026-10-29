-- Make property staff task notifications self-contained: the mail service must not
-- receive direct SELECT on protected property/task/unit tables.
begin;
set local lock_timeout='2s';

create or replace function mzs_private.queue_property_staff_task_notice()
returns trigger language plpgsql security definer set search_path='' as $function$
declare
 v_creator text;
 v_property text;
 v_unit text;
begin
 if new.created_by is distinct from new.assigned_profile_id
    or not exists (
      select 1 from public.profiles p
      where p.id=new.created_by and p.is_active and p.role::text in ('client','partner')
    )
    or not mzs_private.ops_can_work_on_property_as(new.created_by,new.property_id)
 then return new; end if;

 select coalesce(nullif(btrim(p.full_name),''),'Property manager')
 into v_creator from public.profiles p where p.id=new.created_by;
 select p.name into v_property
 from public.mzs_estate_properties p where p.id=new.property_id;
 if new.unit_id is not null then
   select u.address into v_unit from public.mzs_estate_units u
   where u.id=new.unit_id and u.property_id=new.property_id;
 end if;
 if v_property is null or v_creator is null then
   raise exception 'Task notification references unavailable' using errcode='23503';
 end if;
 insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
 select recipient.id,'property_staff_task_created',
   jsonb_build_object(
     'task_id',new.id, 'title',new.title, 'creator',v_creator,
     'property',v_property, 'unit',coalesce(v_unit,''),
     'priority',new.priority, 'due_on',coalesce(new.due_on::text,'')
   ),
   'property-staff-task:'||new.id::text||':'||recipient.id::text
 from public.profiles recipient
 where lower(recipient.email)='magdy@mzsgroup.eu' and recipient.is_active
 on conflict(idempotency_key) do nothing;
 return new;
end $function$;

revoke all on function mzs_private.queue_property_staff_task_notice()
 from public,anon,authenticated,service_role;

-- Repair already queued (unsent) event snapshots without changing task records,
-- the recipient or the idempotency key.
update public.mzs_mail_outbox o
set payload=jsonb_build_object(
 'task_id',t.id,'title',t.title,
 'creator',coalesce(nullif(btrim(creator.full_name),''),'Property manager'),
 'property',prop.name,'unit',coalesce(unit.address,''),
 'priority',t.priority,'due_on',coalesce(t.due_on::text,'')
)
from public.mzs_ops_property_tasks t
join public.profiles creator on creator.id=t.created_by
join public.mzs_estate_properties prop on prop.id=t.property_id
left join public.mzs_estate_units unit on unit.id=t.unit_id and unit.property_id=t.property_id
where o.event_type='property_staff_task_created'
 and o.status='pending' and o.payload->>'task_id'=t.id::text
 and not o.payload ? 'title'
 and t.created_by=t.assigned_profile_id
 and creator.role::text in ('client','partner')
 and exists (
   select 1 from public.profiles recipient
   where recipient.id=o.user_id and lower(recipient.email)='magdy@mzsgroup.eu'
    and recipient.is_active
 );
commit;
